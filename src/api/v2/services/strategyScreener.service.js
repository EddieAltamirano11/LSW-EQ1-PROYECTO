import boom from '@hapi/boom';
import { MARKET_BASKET } from './scanner.service.js';
import { iso, mapConcurrent, unavailable, fromFailure, SourceError } from './strategyScreener/observations.js';
import * as market from './strategyScreener/marketData.js';
import * as sec from './strategyScreener/edgar.js';
import { technicalCore, directSignalsCore, round } from './strategyScreener/technicalCore.js';
import { fecha, mediasMoviles, PARAMETROS, toleranciaNiveles } from './strategyScreener/historialTecnico.js';
import { eventRisk, fundamentalCore, riesgoSinVerificar } from './strategyScreener/fundamentalCore.js';
import { institutionalCore, strategyCore } from './strategyScreener/optionsCores.js';
import { calcularCoreConfluencia, calcularCoreNoticias, CORES_SELECCIONABLES } from './strategyScreener/confluenceCores.js';
import { anexarReaccionMercado, referenciaDeMercado } from './strategyScreener/newsReaction.js';

const ETFS = new Set(['SPY', 'QQQ']);
const DEFAULT_UNIVERSE = MARKET_BASKET.filter(asset => !ETFS.has(asset.symbol));
const NOT_SELECTED = { status: 'NOT_SELECTED', result: null, evidence: [] };
const INPUT_FIELDS = ['mode', 'strategy', 'activeCores', 'limit', 'dteHorizon', 'extraSymbols', 'databaseTarget', 'broker'];

export function parseScreenerInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw boom.badRequest('El cuerpo debe ser un objeto JSON.');
  if (Object.keys(body).some(key => !INPUT_FIELDS.includes(key))) throw boom.badRequest('La solicitud contiene campos no admitidos.');
  const { mode, strategy, activeCores, limit = 5, dteHorizon = 45, extraSymbols = [] } = body;
  if (mode !== 'BY_STRATEGY' || strategy !== 'COLLAR_SPREAD') throw boom.badRequest('El modo admitido es BY_STRATEGY para COLLAR_SPREAD.');
  if (!Array.isArray(activeCores) || activeCores.length === 0 || new Set(activeCores).size !== activeCores.length
      || activeCores.some(core => !CORES_SELECCIONABLES.includes(core))) {
    throw boom.badRequest('Selecciona cores distintos del conjunto 001, 002, 003, 005 y 006.');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw boom.badRequest('limit debe ser un entero entre 1 y 25.');
  if (![30, 45, 60].includes(dteHorizon)) throw boom.badRequest('dteHorizon debe ser 30, 45 o 60.');
  return { mode, strategy, activeCores: CORES_SELECCIONABLES.filter(core => activeCores.includes(core)), limit, dteHorizon, extraSymbols };
}

async function capture(task) {
  try { return { value: await task }; }
  catch (error) { return { error: fromFailure(error) }; }
}

function selected(diagnostic, active) {
  return { ...diagnostic, active };
}

// Participación de cada core: si entró a la confluencia (con su peso normalizado), si solo filtró,
// si se calculó porque otro core lo necesita, si sintetiza a los demás o si no se calculó.
function withRoles(cores, activeCores, strategyEvaluated) {
  const weights = new Map((cores['007'].result?.drivers ?? []).map(driver => [driver.id, driver.weight]));
  const role = id => {
    if (id === '007') return 'SYNTHESIS';
    if (id === '004') return strategyEvaluated ? 'GATE' : 'NOT_COMPUTED';
    if (activeCores.includes(id)) return 'CONFLUENCE';
    if (id === '002') return 'GATE';
    return cores[id].status === 'NOT_SELECTED' ? 'NOT_COMPUTED' : 'DEPENDENCY';
  };
  return Object.fromEntries(Object.entries(cores).map(([id, core]) => {
    const participation = role(id);
    const weight = participation === 'CONFLUENCE' && weights.has(id) ? { effectiveWeight: Number(weights.get(id).toFixed(4)) } : {};
    return [id, { ...core, role: participation, ...weight }];
  }));
}

export function createStrategyScreener({ marketData = market, edgar = sec, universe = DEFAULT_UNIVERSE, now = Date.now } = {}) {
  let snapshot;
  return async function run(criteria) {
    const time = now();
    if (!snapshot || time < snapshot.asOf || time - snapshot.asOf >= 90_000) {
      snapshot = { asOf: time, values: new Map() };
    }
    const { asOf, values } = snapshot;
    const signal = AbortSignal.timeout(45_000);
    const use = (key, load) => {
      if (!values.has(key)) {
        values.set(key, capture(Promise.resolve().then(load)).then(result => {
          if (result.error) values.delete(key);
          return result;
        }).catch(error => {
          values.delete(key);
          throw error;
        }));
      }
      return values.get(key);
    };
    const includes = id => criteria.activeCores.includes(id);
    const [clock, issuerIndex] = await Promise.all([
      use('clock', () => marketData.obtenerSesionBursatil(asOf, signal)),
      use('issuers', () => edgar.issuerIndex(signal)),
    ]);
    if (!clock.value || !issuerIndex.value) {
      const reason = [clock.error?.reason, issuerIndex.error?.reason].filter(Boolean).join(' ');
      throw boom.serverUnavailable(`Datos reales insuficientes. ${reason}`);
    }
    const holdings = includes('005') ? use('13F', () => edgar.holdingsReport(asOf, signal)) : null;

    const extraList = Array.isArray(criteria.extraSymbols)
      ? criteria.extraSymbols
      : typeof criteria.extraSymbols === 'string'
      ? criteria.extraSymbols.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : [];
    const activeUniverse = [...universe];
    for (const sym of extraList) {
      if (!activeUniverse.some((a) => a.symbol === sym) && !ETFS.has(sym)) {
        activeUniverse.push({ symbol: sym, companyName: `${sym} Inc.` });
      }
    }

    const rows = await mapConcurrent(activeUniverse, 3, async asset => {
      const { symbol, companyName } = asset;
      const documentos = edgar.companySubmissions
        ? use(`submissions:${symbol}`, () => edgar.companySubmissions(symbol, issuerIndex.value, signal))
        : Promise.resolve({});
      const [spot, facts, event, history, news, reportes] = await Promise.all([
        use(`spot:${symbol}`, () => marketData.obtenerPrecioSubyacente(symbol, clock.value, signal)),
        documentos.then(filings => filings.error ? filings
          : use(`facts:${symbol}`, () => edgar.statements(symbol, issuerIndex.value, asOf, signal, filings.value))),
        use(`earnings:${symbol}`, () => marketData.obtenerFechaResultados(symbol, asOf, signal)),
        includes('001') || includes('003') ? use(`history:${symbol}`, () => marketData.obtenerHistorialVelas(symbol, clock.value, signal)) : {},
        includes('006') ? use(`news:${symbol}`, () => marketData.obtenerNoticiasAccion(symbol, asOf, signal)) : {},
        includes('006') && edgar.filingsNews
          ? documentos.then(filings => filings.error ? filings
            : use(`filingsNews:${symbol}`, () => edgar.filingsNews(symbol, filings.value, asOf, signal)))
          : {},
      ]);
      const newsCore = includes('006') ? calcularCoreNoticias(news.value, asOf, asset, reportes, news.error) : NOT_SELECTED;
      if (newsCore.result?.events.length && marketData.obtenerVelasEventos) {
        const referencia = referenciaDeMercado(asset);
        const barras = ticker => use(`eventBars:${ticker}`, () => marketData.obtenerVelasEventos(ticker, clock.value, signal));
        const [activo, comparacion] = await Promise.all([
          history.value?.series?.['1Day'] ? { value: history.value.series['1Day'] } : barras(symbol),
          barras(referencia),
        ]);
        newsCore.result.events = anexarReaccionMercado(newsCore.result.events, clock.value, activo.value, referencia, comparacion.value);
      }
      const events = event.error ? riesgoSinVerificar(event.error.reason, event.error.evidence?.[0]?.source) : eventRisk(event.value, asOf);
      const fundamental = spot.error ?? facts.error ?? fundamentalCore(facts.value, spot.value, events);
      const eligibility = fundamental.result?.classification ?? 'UNKNOWN';
      const technical = history.error ?? (history.value ? technicalCore(history.value) : NOT_SELECTED);
      const knownVeto = eligibility === 'MARGINAL' || eligibility === 'NO_VIABLE';
      const chain = eligibility === 'VIABLE' && spot.value
        ? await use(`chain:${symbol}:${criteria.dteHorizon}`, () => marketData.obtenerCadenaOpciones(symbol, spot.value, criteria.dteHorizon, clock.value, signal))
        : {};
      const strategy = chain.error ?? (chain.value ? strategyCore(spot.value, chain.value)
        : unavailable(knownVeto ? `Veto de viabilidad ${eligibility}.` : 'Viabilidad de la empresa sin verificar.'));
      let institutional = NOT_SELECTED;
      if (includes('005')) {
        const report = await holdings;
        const flow = chain.value ? await use(`flow:${symbol}:${criteria.dteHorizon}`, () => marketData.obtenerFlujoOpciones(chain.value, clock.value, signal)) : {};
        institutional = flow.error ?? institutionalCore(flow.value, edgar.reportedHoldings(report.value, symbol), report.value?.evidence);
      }
      const cores = {
        '001': selected(technical, includes('001')),
        '002': selected(fundamental, includes('002')),
        '003': selected(includes('003') ? directSignalsCore(technical, events) : NOT_SELECTED, includes('003')),
        '004': strategy,
        '005': selected(institutional, includes('005')),
        '006': selected(newsCore, includes('006')),
      };
      const confluence = calcularCoreConfluencia(criteria.activeCores, cores, asOf);
      cores['007'] = confluence;
      const row = { symbol, companyName, eligibility, cores: withRoles(cores, criteria.activeCores, Boolean(chain.value || chain.error)) };
      if (knownVeto) return { ...row, reason: `Veto de viabilidad ${eligibility}.`, exclusionType: 'VIABILITY_VETO' };
      if (eligibility !== 'VIABLE' || !events.result || !strategy.result) {
        return { ...row, reason: fundamental.reason ?? strategy.reason ?? events.reason ?? 'Datos de viabilidad insuficientes.',
          exclusionType: 'INSUFFICIENT_DATA', incomplete: true };
      }
      if (!strategy.result.eligible) return { ...row, reason: strategy.result.reason, exclusionType: 'NO_COLLAR' };
      if (!Number.isFinite(confluence.score)) {
        const missing = criteria.activeCores.filter(id => !Number.isFinite(cores[id].score));
        return { ...row, reason: `Datos insuficientes para ${missing.join(', ')}.`, exclusionType: 'INSUFFICIENT_DATA', incomplete: true };
      }
      return { ...row, score: confluence.score,
        incomplete: events.result.risk === 'UNVERIFIED' || criteria.activeCores.some(id => cores[id].status === 'PARTIAL') };
    });
    if (rows.every(row => row.incomplete && row.reason)) {
      const reasons = [...new Set(rows.map(row => row.reason))].slice(0, 3);
      throw boom.serverUnavailable(`Datos reales insuficientes. ${reasons.join(' ')}`);
    }
    const candidates = rows.filter(row => !row.reason).sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))
      .slice(0, criteria.limit).map(({ incomplete, ...row }, index) => ({ ...row, partial: Boolean(incomplete), rank: index + 1 }));
    const excluded = rows.filter(row => row.reason).map(({ incomplete, ...row }) => row);
    return { asOf: iso(asOf), criteria, status: rows.some(row => row.incomplete) ? 'PARTIAL' : 'COMPLETE', candidates, excluded };
  };
}

export const runStrategyScreener = createStrategyScreener();

const TECHNICAL_SYMBOL = /^[A-Z]{1,5}(?:[.-][A-Z]{1,2})?$/;

export function parseTechnicalSymbol(value) {
  const symbol = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!TECHNICAL_SYMBOL.test(symbol)) throw boom.badRequest('El símbolo debe tener de 1 a 5 letras, con una clase opcional como BRK.B.');
  return symbol;
}

function sourceFailure(error) {
  if (error instanceof SourceError) return boom.serverUnavailable(`Datos reales insuficientes. ${error.reason}`);
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return boom.serverUnavailable('Datos reales insuficientes. La fuente de velas no respondió a tiempo.');
  }
  return error;
}

// Serie diaria del Core 001 para la gráfica técnica: mismas velas y mismos cálculos que el ranking, sin la serie intradía.
function technicalSeries(symbol, clock, history, asOf) {
  const core = technicalCore(history);
  if (!core.result) throw boom.serverUnavailable(`Datos reales insuficientes. ${core.reason}`);
  const daily = history.series['1Day'];
  const times = daily.map(bar => fecha(bar.at));
  const averages = mediasMoviles(daily.map(bar => bar.close));
  const line = values => values.flatMap((value, index) => (value === null ? [] : [{ time: times[index], value: round(value, 4) }]));
  const tolerance = toleranciaNiveles(core.result.timeframes.daily.atr, daily.at(-1).close);
  const band = level => ({ ...level, lower: round(level.price - tolerance, 4), upper: round(level.price + tolerance, 4) });
  const { support, resistance, scales, segments, projections, limitation } = core.result;
  return {
    symbol, asOf: iso(asOf), cutoff: iso(clock.cutoff), lastSession: clock.lastClosed.date, source: market.FUENTE_ALPACA,
    candles: daily.map(({ open, high, low, close, volume }, index) => ({ time: times[index], open, high, low, close, volume })),
    movingAverages: { sma200: line(averages.sma200), ema50: line(averages.ema50), ema20: line(averages.ema20) },
    support: support.map(band), resistance: resistance.map(band), scales, segments, projections,
    upcoming: (history.calendar ?? []).slice(0, PARAMETROS.horizonte), limitation, evidence: history.evidence,
  };
}

export function createTechnicalSeries({ marketData = market, now = Date.now } = {}) {
  let snapshot;
  return async function series(symbol) {
    const time = now();
    if (!snapshot || time < snapshot.asOf || time - snapshot.asOf >= 90_000) snapshot = { asOf: time, values: new Map() };
    const { asOf, values } = snapshot;
    const signal = AbortSignal.timeout(45_000);
    // Igual que el screener: lo exitoso se reutiliza 90 s y lo fallido se descarta para el siguiente intento.
    const use = (key, load) => {
      if (!values.has(key)) {
        const pending = Promise.resolve().then(load);
        values.set(key, pending);
        pending.catch(() => { if (values.get(key) === pending) values.delete(key); });
      }
      return values.get(key);
    };
    try {
      return await use(`series:${symbol}`, async () => {
        const clock = await use('clock', () => marketData.obtenerSesionBursatil(asOf, signal));
        const history = await marketData.obtenerHistorialVelas(symbol, clock, signal);
        return technicalSeries(symbol, clock, history, asOf);
      });
    } catch (error) {
      throw sourceFailure(error);
    }
  };
}

export const runTechnicalSeries = createTechnicalSeries();
