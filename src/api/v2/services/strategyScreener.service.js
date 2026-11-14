import boom from '@hapi/boom';
import { MARKET_BASKET } from './scanner.service.js';
import { iso, mapConcurrent, unavailable, fromFailure, SourceError } from './strategyScreener/observations.js';
import * as market from './strategyScreener/marketData.js';
import * as sec from './strategyScreener/edgar.js';
import { technicalCore, directSignalsCore } from './strategyScreener/technicalCore.js';
import { eventRisk, fundamentalCore } from './strategyScreener/fundamentalCore.js';
import { institutionalCore, strategyCore } from './strategyScreener/optionsCores.js';
import { confluenceCore, newsCore, SOURCE_CORES } from './strategyScreener/confluenceCores.js';

const ETFS = new Set(['SPY', 'QQQ']);
const DEFAULT_UNIVERSE = MARKET_BASKET.filter(asset => !ETFS.has(asset.symbol));
const NOT_SELECTED = { status: 'NOT_SELECTED', result: null, evidence: [] };
const INPUT_FIELDS = ['mode', 'strategy', 'activeCores', 'limit', 'dteHorizon'];

export function parseScreenerInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw boom.badRequest('El cuerpo debe ser un objeto JSON.');
  if (Object.keys(body).some(key => !INPUT_FIELDS.includes(key))) throw boom.badRequest('La solicitud contiene campos no admitidos.');
  const { mode, strategy, activeCores, limit = 5, dteHorizon = 45 } = body;
  if (mode !== 'BY_STRATEGY' || strategy !== 'COLLAR_SPREAD') throw boom.badRequest('El modo admitido es BY_STRATEGY para COLLAR_SPREAD.');
  if (!Array.isArray(activeCores) || activeCores.length === 0 || new Set(activeCores).size !== activeCores.length
      || activeCores.some(core => !SOURCE_CORES.includes(core))) {
    throw boom.badRequest('Selecciona cores distintos del conjunto 001, 002, 003, 005 y 006.');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw boom.badRequest('limit debe ser un entero entre 1 y 10.');
  if (![30, 45, 60].includes(dteHorizon)) throw boom.badRequest('dteHorizon debe ser 30, 45 o 60.');
  return { mode, strategy, activeCores: SOURCE_CORES.filter(core => activeCores.includes(core)), limit, dteHorizon };
}

async function capture(task) {
  try { return { value: await task }; }
  catch (error) { return { error: fromFailure(error) }; }
}

function selected(diagnostic, active) {
  return { ...diagnostic, active };
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
      use('clock', () => marketData.marketSession(asOf, signal)),
      use('issuers', () => edgar.issuerIndex(signal)),
    ]);
    if (!clock.value || !issuerIndex.value) {
      const reason = [clock.error?.reason, issuerIndex.error?.reason].filter(Boolean).join(' ');
      throw boom.serverUnavailable(`Datos reales insuficientes. ${reason}`);
    }
    const holdings = includes('005') ? use('13F', () => edgar.holdingsReport(asOf, signal)) : null;
    const rows = await mapConcurrent(universe, 3, async asset => {
      const { symbol, companyName } = asset;
      const [spot, facts, event, history, news] = await Promise.all([
        use(`spot:${symbol}`, () => marketData.stockSpot(symbol, clock.value, signal)),
        use(`facts:${symbol}`, () => edgar.statements(symbol, issuerIndex.value, asOf, signal)),
        use(`earnings:${symbol}`, () => marketData.earnings(symbol, asOf, signal)),
        includes('001') || includes('003') ? use(`history:${symbol}`, () => marketData.stockHistory(symbol, clock.value, signal)) : {},
        includes('006') ? use(`news:${symbol}`, () => marketData.stockNews(symbol, asOf, signal)) : {},
      ]);
      const events = event.error ?? eventRisk(event.value, asOf);
      const fundamental = spot.error ?? facts.error ?? fundamentalCore(facts.value, spot.value, events);
      const eligibility = fundamental.result?.classification ?? 'UNKNOWN';
      const technical = history.error ?? (history.value ? technicalCore(history.value) : NOT_SELECTED);
      const knownVeto = eligibility === 'MARGINAL' || eligibility === 'NO_VIABLE';
      const chain = eligibility === 'VIABLE' && spot.value
        ? await use(`chain:${symbol}:${criteria.dteHorizon}`, () => marketData.optionsChain(symbol, spot.value, criteria.dteHorizon, clock.value, signal))
        : {};
      const strategy = chain.error ?? (chain.value ? strategyCore(spot.value, chain.value)
        : unavailable(knownVeto ? `Veto de viabilidad ${eligibility}.` : 'Viabilidad de la empresa sin verificar.'));
      let institutional = NOT_SELECTED;
      if (includes('005')) {
        const report = await holdings;
        const flow = chain.value ? await use(`flow:${symbol}:${criteria.dteHorizon}`, () => marketData.optionFlow(chain.value, clock.value, signal)) : {};
        institutional = flow.error ?? institutionalCore(flow.value, edgar.reportedHoldings(report.value, symbol), report.value?.evidence);
      }
      const cores = {
        '001': selected(technical, includes('001')),
        '002': selected(fundamental, includes('002')),
        '003': selected(includes('003') ? directSignalsCore(technical, events) : NOT_SELECTED, includes('003')),
        '004': strategy,
        '005': selected(institutional, includes('005')),
        '006': selected(includes('006') ? (news.error ?? newsCore(news.value, asOf)) : NOT_SELECTED, includes('006')),
      };
      const confluence = confluenceCore(criteria.activeCores, cores, asOf);
      cores['007'] = confluence;
      const row = { symbol, companyName, eligibility, cores };
      if (knownVeto) return { ...row, reason: `Veto de viabilidad ${eligibility}.` };
      if (eligibility !== 'VIABLE' || !events.result || !strategy.result) {
        return { ...row, reason: fundamental.reason ?? strategy.reason ?? events.reason ?? 'Datos de viabilidad insuficientes.', incomplete: true };
      }
      if (!strategy.result.eligible) return { ...row, reason: strategy.result.reason };
      if (!Number.isFinite(confluence.score)) {
        const missing = criteria.activeCores.filter(id => !Number.isFinite(cores[id].score));
        return { ...row, reason: `Datos insuficientes para ${missing.join(', ')}.`, incomplete: true };
      }
      return { ...row, score: confluence.score,
        incomplete: criteria.activeCores.some(id => cores[id].status === 'PARTIAL') };
    });
    if (rows.every(row => row.incomplete && row.reason)) {
      const reasons = [...new Set(rows.map(row => row.reason))].slice(0, 3);
      throw boom.serverUnavailable(`Datos reales insuficientes. ${reasons.join(' ')}`);
    }
    const candidates = rows.filter(row => !row.reason).sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))
      .slice(0, criteria.limit).map(({ incomplete, ...row }, index) => ({ ...row, rank: index + 1 }));
    const excluded = rows.filter(row => row.reason).map(({ incomplete, ...row }) => row);
    return { asOf: iso(asOf), criteria, status: rows.some(row => row.incomplete) ? 'PARTIAL' : 'COMPLETE', candidates, excluded };
  };
}

export const runStrategyScreener = createStrategyScreener();
