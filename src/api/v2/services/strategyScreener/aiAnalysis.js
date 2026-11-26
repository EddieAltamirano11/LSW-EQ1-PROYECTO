import boom from '@hapi/boom';
import { parseScreenerInput, parseTechnicalSymbol, runStrategyScreener } from '../strategyScreener.service.js';
import { createAiProvider } from './aiProvider.js';

const FIELDS = ['scope', 'symbol', 'activeCores', 'dteHorizon', 'extraSymbols'];
const VERDICTS = ['CONSIDER', 'AVOID', 'WAIT'];

export function parseAiAnalysisInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !FIELDS.includes(key))) {
    throw boom.badRequest('Envía solo el alcance y los criterios del análisis.');
  }
  const { scope, symbol, activeCores, dteHorizon, extraSymbols = [] } = body;
  if (!['CANDIDATES', 'SYMBOL'].includes(scope)) throw boom.badRequest('El alcance debe ser CANDIDATES o SYMBOL.');
  if (scope === 'CANDIDATES' ? Object.hasOwn(body, 'symbol') : Object.hasOwn(body, 'extraSymbols')) {
    throw boom.badRequest('Usa symbol para SYMBOL y extraSymbols para CANDIDATES.');
  }
  if (!Array.isArray(extraSymbols) || extraSymbols.length > 25) {
    throw boom.badRequest('Envía hasta 25 símbolos adicionales en una lista.');
  }
  return {
    scope,
    symbol: scope === 'SYMBOL' ? parseTechnicalSymbol(symbol) : undefined,
    criteria: parseScreenerInput({
      mode: 'BY_STRATEGY', strategy: 'COLLAR_SPREAD', activeCores, dteHorizon, limit: 25,
      extraSymbols: [...new Set(extraSymbols.map(parseTechnicalSymbol))],
    }),
  };
}

function sourcesOf(evidence) {
  const sources = new Map();
  for (const entry of evidence) {
    if (typeof entry?.source !== 'string' || !Number.isFinite(Date.parse(entry.observedAt))) continue;
    const { source, observedAt, reference } = entry;
    const name = typeof reference === 'string' ? reference : null;
    sources.set(JSON.stringify([source, observedAt, name]), { source, observedAt, reference: name });
  }
  return [...sources.values()].slice(0, 4);
}

function evidenceFor(row) {
  const evidence = [];
  const add = (id, label, detail, observations = [], status = 'AVAILABLE') => {
    const sources = sourcesOf(observations);
    if (sources.length) evidence.push({ id: `${row.symbol}/${id}`, label, detail, status, sources });
  };
  const metric = (label, value, unit = '') => Number.isFinite(value) ? `${label} ${value}${unit}` : null;
  const detail = (...values) => values.filter(Boolean).join(' · ');
  const {
    '001': technical, '002': fundamental, '003': direct, '004': collar,
    '005': institutional, '006': news, '007': confluence,
  } = row.cores;

  if (technical?.result) {
    const { trend, indicators } = technical.result;
    add('technical', 'Análisis técnico', detail(`Tendencia ${trend}`, metric('RSI', indicators?.rsi?.value),
      metric('ADX', indicators?.adx?.value)), technical.evidence, technical.status);
  }
  if (fundamental?.result) {
    const { classification, event, altman, valuation, indicators } = fundamental.result;
    const verified = ['HIGH', 'MEDIUM', 'LOW'].includes(event?.risk);
    const observations = fundamental.evidence ?? [];
    const financial = verified ? observations.slice(0, -1) : observations;
    add('fundamental', 'Viabilidad y valoración', detail(classification, metric('Altman', altman?.value),
      altman && `Umbrales Altman ${altman.lower} y ${altman.upper}`, valuation, metric('P/E', indicators?.pe),
      metric('Flujo de caja operativo', indicators?.operatingCashFlow, ' USD'), metric('Margen operativo',
        Number.isFinite(indicators?.operatingMargin) ? Number((indicators.operatingMargin * 100).toFixed(1)) : null, ' %')),
    financial, fundamental.status);
    if (verified) {
      const window = event.start === event.end ? event.start : `${event.start} a ${event.end}`;
      add('events', 'Resultados trimestrales', detail(`Riesgo ${event.risk}`,
        `${event.estimated ? 'Estimación' : 'Calendario informado'} ${window}`, metric('Días hasta resultados', event.days)),
      observations.slice(-1));
    }
  }
  if (direct?.result) {
    add('signal', 'Señales directas', detail(direct.result.signal, direct.result.rule), direct.evidence, direct.status);
  }
  if (collar?.result) {
    const { eligible, expiration, put, call, netPremiumPerShare, maxLoss, maxProfit, breakEven, shares } = collar.result;
    const observations = collar.evidence ?? [];
    add('collar', 'Collar Spread', eligible
      ? detail(`Vencimiento ${expiration}`, metric('Piso Put', put?.strike, ' USD/acción'), metric('Techo Call', call?.strike, ' USD/acción'),
        metric('Prima neta por pagar (negativa si es crédito)', netPremiumPerShare, ' USD/acción'), metric('Acciones cubiertas', shares),
        metric('Pérdida máxima', maxLoss, ' USD'), metric('Ganancia máxima', maxProfit, ' USD'),
        metric('Punto de equilibrio', breakEven, ' USD/acción'), 'Antes de comisiones')
      : 'La cadena evaluada no contiene un collar con liquidez y costo verificables.',
    eligible ? [...observations.slice(-2), ...observations.slice(0, 1)] : observations, collar.status);
  }
  if (institutional?.result) {
    add('flow', 'Flujo de opciones', `Dirección observada en la muestra ${institutional.result.direction}`,
      institutional.evidence, institutional.status);
  }
  if (news?.result) {
    add('news', 'Noticias', detail(`Sentimiento estimado ${news.result.sentiment}`,
      metric('Noticias observadas', news.result.observed)), news.evidence, news.status);
  }
  if (confluence?.result) {
    const { score, signal, conflicts } = confluence.result;
    add('confluence', 'Confluencia', detail(metric('Puntaje', score, ' / 100'), signal,
      conflicts?.length ? 'Hay señales en conflicto' : null), confluence.evidence?.slice(0, 1), confluence.status);
  }
  return evidence;
}

function missingData(row, evidence) {
  if (row?.exclusionType === 'INSUFFICIENT_DATA') return row.reason;
  const event = row?.cores['002']?.result?.event;
  if (!event || event.risk === 'UNVERIFIED') {
    return event?.reason ?? 'No hay una fecha de resultados verificable.';
  }
  if (!['fundamental', 'collar', 'events'].every(id => evidence.some(fact => fact.id === `${row.symbol}/${id}`))) {
    return 'Falta evidencia fechada para la viabilidad, el collar o el calendario de resultados.';
  }
  return null;
}

function scannerVerdict(symbol, verdict, reason, fact) {
  return { symbol, verdict, reasons: [{ text: reason, evidenceId: fact?.id ?? null }], risks: [],
    evidence: fact ? [fact] : [] };
}

function checkedRecommendations(response, scope, assets) {
  const list = response?.recommendations;
  const invalid = () => boom.badGateway('El análisis de IA no coincide con la evidencia disponible.');
  if (!Array.isArray(list) || (scope === 'SYMBOL' ? list.length !== 1 : list.length > 3)) throw invalid();
  const used = new Set();
  return list.map(item => {
    const asset = assets.find(value => value.symbol === item?.symbol);
    if (!asset || used.has(item.symbol) || !VERDICTS.includes(item.verdict)
        || (scope === 'CANDIDATES' && item.verdict !== 'CONSIDER')) throw invalid();
    used.add(item.symbol);
    const cited = new Set();
    const checkPoints = (points, minimum) => {
      if (!Array.isArray(points) || points.length < minimum || points.length > 2) throw invalid();
      return points.map(point => {
        const text = typeof point?.text === 'string' ? point.text.trim() : '';
        const id = point?.evidenceId;
        if (!text || text.length > 480 || !asset.evidence.some(fact => fact.id === id)) throw invalid();
        cited.add(id);
        return { text, evidenceId: id };
      });
    };
    const reasons = checkPoints(item.reasons, 1);
    const risks = checkPoints(item.risks, 0);
    return { symbol: asset.symbol, verdict: item.verdict, reasons, risks,
      evidence: asset.evidence.filter(fact => cited.has(fact.id)) };
  });
}

export function createAiAnalysis({ run = runStrategyScreener, prepare = createAiProvider() } = {}) {
  return async function analyze({ scope, symbol, criteria }, signal) {
    const complete = prepare();
    const { asOf, candidates, excluded } = await run(criteria, { symbol });
    signal?.throwIfAborted();
    const response = { scope, strategy: criteria.strategy, dteHorizon: criteria.dteHorizon, asOf,
      model: null, status: 'COMPLETE', message: null, recommendations: [] };
    let assets;
    if (scope === 'SYMBOL') {
      const row = [...candidates, ...excluded].find(value => value.symbol === symbol);
      if (!row) {
        return { ...response, status: 'INSUFFICIENT_DATA',
          recommendations: [scannerVerdict(symbol, 'INSUFFICIENT_DATA', 'El escáner no tiene diagnósticos para este ticker.')] };
      }
      const evidence = evidenceFor(row);
      if (['VIABILITY_VETO', 'NO_COLLAR'].includes(row.exclusionType)) {
        const id = row.exclusionType === 'NO_COLLAR' ? 'collar' : 'fundamental';
        return { ...response, recommendations: [scannerVerdict(symbol, 'AVOID', row.reason,
          evidence.find(fact => fact.id === `${symbol}/${id}`))] };
      }
      const missing = missingData(row, evidence);
      if (missing) {
        return { ...response, status: 'INSUFFICIENT_DATA',
          recommendations: [scannerVerdict(symbol, 'INSUFFICIENT_DATA', missing)] };
      }
      assets = [{ symbol, evidence }];
    } else {
      assets = candidates.flatMap(row => {
        const evidence = evidenceFor(row);
        return missingData(row, evidence) ? [] : [{ symbol: row.symbol, evidence }];
      }).slice(0, 10);
      if (!assets.length) {
        const incomplete = candidates.length > 0 || excluded.some(row => row.exclusionType === 'INSUFFICIENT_DATA');
        return { ...response, status: incomplete ? 'INSUFFICIENT_DATA' : 'NO_SUGGESTIONS',
          message: incomplete ? 'No hay candidatas con evidencia suficiente para esta consulta.'
            : 'Ninguna empresa cumple los criterios de viabilidad y liquidez para este horizonte.' };
      }
    }

    const { model, result } = await complete({
      scope, strategy: response.strategy, dteHorizon: response.dteHorizon, asOf,
      assets: assets.map(({ symbol: ticker, evidence }) => ({
        symbol: ticker, evidence: evidence.map(({ id, label, detail, status }) => ({ id, label, detail, status })),
      })),
    }, signal);
    const recommendations = checkedRecommendations(result, scope, assets);
    return recommendations.length ? { ...response, model, recommendations }
      : { ...response, model, status: 'NO_SUGGESTIONS', message: 'La IA no destacó ninguna candidata con la evidencia evaluada.' };
  };
}

export const runAiAnalysis = createAiAnalysis();
