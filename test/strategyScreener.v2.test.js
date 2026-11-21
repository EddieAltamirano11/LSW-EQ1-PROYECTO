import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import config from '../src/config/config.js';
import { authMiddleware } from '../src/middlewares/auth.middleware.js';
import { errorHandler } from '../src/middlewares/errorHandler.middleware.js';
import { strategyScreenerRoutes } from '../src/api/v2/routes/strategyScreener.routes.js';
import { createStrategyScreener, parseScreenerInput } from '../src/api/v2/services/strategyScreener.service.js';
import { available, observation, SourceError } from '../src/api/v2/services/strategyScreener/observations.js';
import { technicalCore, directSignalsCore } from '../src/api/v2/services/strategyScreener/technicalCore.js';
import { eventRisk, fundamentalCore } from '../src/api/v2/services/strategyScreener/fundamentalCore.js';
import { institutionalCore, strategyCore } from '../src/api/v2/services/strategyScreener/optionsCores.js';
import { calcularCoreConfluencia, calcularCoreNoticias, CORES_SELECCIONABLES } from '../src/api/v2/services/strategyScreener/confluenceCores.js';

const asOf = Date.parse('2026-11-12T22:00:00Z');
const observed = observation('Fuente controlada', '2026-11-12T21:00:00Z', 'Observación de prueba');
const criteria = { mode: 'BY_STRATEGY', strategy: 'COLLAR_SPREAD', activeCores: CORES_SELECCIONABLES };
const stock = { price: 100, evidence: observed };
const earnings = { start: '2027-01-20', end: '2027-01-21', estimated: true, evidence: observed };

function financial(scenario) {
  const prior = { end: '2025-09-30', assets: 1000, currentAssets: 600, currentLiabilities: 200, liabilities: 500,
    equity: 500, retained: 260, cash: 280, longDebt: 200, currentDebt: 50, shortDebt: 0,
    revenue: 1800, gross: 600, operating: 330, net: 300, cashFlow: 340, interest: null, eps: 10, shares: 100 };
  const current = { ...prior, end: '2026-09-30', revenue: 2000, gross: 750, operating: 400, net: 360, cashFlow: 440 };
  if (scenario === 'MARGINAL') current.cashFlow = -100;
  if (scenario === 'NO_VIABLE') Object.assign(current, { retained: -1600, equity: -500, operating: -800, liabilities: 1500 });
  if (scenario === 'UNKNOWN') current.retained = null;
  return { years: [current, prior], cik: '0012345678', sic: 3571, evidence: [observed], references: [] };
}

function history(direction = 1, lastVolume = 300) {
  const bars = Array.from({ length: 80 }, (_, i) => ({
    at: asOf - (80 - i) * 3600000, open: 100 + direction * i * 0.1,
    high: 100.2 + direction * i * 0.1, low: 99.9 + direction * i * 0.1,
    close: 100.1 + direction * i * 0.1, volume: i === 79 ? lastVolume : 100,
  }));
  if (direction > 0) Object.assign(bars.at(-1), { high: 110, close: 109 });
  return { series: { '1Day': bars, '1Hour': bars, '15Min': bars }, evidence: [observed] };
}

function chain() {
  const base = { underlying: 'TEST', expiration: '2026-12-24', bid: 2, ask: 2.2,
    multiplier: 100, standard: true, volume: 100, interest: 80, gamma: 0.04, delay: 15, at: asOf - 3600000 };
  return { target: Date.parse(base.expiration), evidence: [observed], contracts: [
    { ...base, symbol: 'TEST261224P00095000', type: 'put', strike: 95 },
    { ...base, symbol: 'TEST261224C00105000', type: 'call', strike: 105 },
  ] };
}

test('001 combina temporalidades, requiere volumen en ruptura y expone la cobertura', () => {
  const trend = technicalCore(history());
  assert.equal(trend.result.trend, 'UP');
  assert.equal(trend.result.timeframes.intraday.breakout, 1);
  assert.equal(technicalCore(history(1, 100)).result.timeframes.intraday.breakout, 0);
  assert.equal(technicalCore({ series: {} }).status, 'UNAVAILABLE');
  assert.deepEqual(technicalCore(history()), trend);
});

test('002 distingue los cuatro estados y 003 aplica confirmación y riesgo', () => {
  const event = eventRisk(earnings, asOf);
  for (const scenario of ['VIABLE', 'MARGINAL', 'NO_VIABLE', 'UNKNOWN']) {
    assert.equal(fundamentalCore(financial(scenario), stock, event).result.classification, scenario);
  }
  assert.equal(directSignalsCore(technicalCore(history()), event).result.signal, 'BUY');
  assert.equal(directSignalsCore(technicalCore(history(-1)), event).result.signal, 'SELL');
  assert.equal(directSignalsCore(technicalCore(history()), available({ risk: 'HIGH' }, [observed])).result.signal, 'HOLD');
  assert.equal(directSignalsCore(null, event).status, 'UNAVAILABLE');
});

test('004 valora ask y bid observados y rechaza un par sin liquidez o entregables compatibles', () => {
  const result = strategyCore(stock, chain()).result;
  assert.equal(result.maxLoss, 520);
  assert.equal(result.maxProfit, 480);
  assert.equal(result.breakEven, 100.2);
  for (const changes of [{ interest: 0 }, { standard: false }, { expiration: '2026-12-31' }]) {
    const data = chain();
    Object.assign(data.contracts[0], changes);
    assert.equal(strategyCore(stock, data).result.eligible, false);
  }
});

test('005 respeta el lado observado y 006 distingue ventanas vacías de fallas', () => {
  const contract = chain().contracts[1];
  const trades = Array.from({ length: 3 }, () => ({ price: 2, size: 2, side: 'B' }));
  const data = [{ contract, trades, evidence: observed }];
  assert.equal(institutionalCore(data, {}, observed).result.direction, 'BULLISH');
  data[0].trades = trades.map(row => ({ ...row, side: null }));
  assert.equal(institutionalCore(data, {}, observed).result.direction, 'UNDETERMINED');
  const article = { id: 1, source: 'Fuente', headline: 'Company beats earnings estimates', symbols: ['TEST'], created_at: observed.observedAt };
  const news = calcularCoreNoticias({ evidence: observed, articles: [article, { ...article, id: 2 }] }, asOf);
  assert.equal(news.result.observed, 1);
  assert.equal(news.result.sentiment, 'POSITIVE');
  assert.equal(calcularCoreNoticias({ evidence: observed, articles: [] }, asOf).result.sentiment, 'NEUTRAL');
  assert.equal(calcularCoreNoticias(null, asOf).status, 'UNAVAILABLE');
});

test('007 combina pesos sin tratar 001 y 003 como confirmaciones independientes', () => {
  const cores = Object.fromEntries(CORES_SELECCIONABLES.map(id => [id, available({}, [observed], { score: 80, confidence: 1, direction: 1 })]));
  for (const id of CORES_SELECCIONABLES) {
    const result = calcularCoreConfluencia([id], cores, asOf).result;
    assert.equal(result.mode, 'INDIVIDUAL');
    assert.equal(result.signal, null);
    assert.equal(result.score, 80);
  }
  assert.equal(calcularCoreConfluencia(['001', '003'], cores, asOf).result.signal, 'HOLD');
  assert.equal(calcularCoreConfluencia(['001', '006'], cores, asOf).result.signal, 'BUY');
  cores['006'].direction = -1;
  const result = calcularCoreConfluencia(['001', '006'], cores, asOf).result;
  assert.equal(result.signal, 'HOLD');
  assert.ok(result.confidence < 0.95);
  assert.ok(result.conflicts.length);
  assert.equal(result.drivers.reduce((sum, value) => sum + value.weight, 0), 1);
});

test('ruta autenticada entrega resultados completos y parciales, veta, valida y reporta 503', async t => {
  const universe = ['CCC', 'AAA', 'BBB'].map(symbol => ({ symbol, companyName: symbol }));
  const successful = () => chain();
  let phase = 'PARTIAL';
  let calls = 0;
  let tick = asOf;
  const run = createStrategyScreener({ universe, now: () => tick,
    edgar: { issuerIndex: async () => new Map(), holdingsReport: async () => ({ evidence: observed }), reportedHoldings: () => ({}),
      statements: async symbol => {
        if (phase === 'DOWN' || (phase === 'PARTIAL' && symbol === 'CCC')) throw new SourceError('SEC', 'Sin estados financieros.');
        return financial(phase === 'VETO' || symbol === 'BBB' ? 'MARGINAL' : 'VIABLE');
      } },
    marketData: { obtenerSesionBursatil: async () => { calls++; return {}; }, obtenerPrecioSubyacente: async () => stock,
      obtenerHistorialVelas: async () => history(), obtenerFechaResultados: async () => earnings, obtenerCadenaOpciones: async () => successful(),
      obtenerNoticiasAccion: async () => ({ articles: [], evidence: observed }), obtenerFlujoOpciones: async () => [{ contract: chain().contracts[0],
        trades: [{ price: 2, size: 2, side: null }], evidence: observed }] },
  });
  const app = express();
  app.use(express.json(), authMiddleware);
  app.use('/api/v2/strategy-screener', strategyScreenerRoutes(run));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/api/v2/strategy-screener/run`;
  const token = jwt.sign({ user: 'Pruebas de escáner' }, config.JWT_SECRET, { expiresIn: '5m' });
  const post = (body, auth = token) => fetch(url, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(auth && { Authorization: `Bearer ${auth}` }),
  }, body: JSON.stringify(body) });
  assert.equal((await post(criteria, '')).status, 401);
  assert.equal((await post({ ...criteria, activeCores: ['004'] })).status, 400);
  assert.equal((await post({ ...criteria, limit: 1.5 })).status, 400);
  assert.equal(calls, 0);
  let response = await post(criteria);
  assert.equal(response.status, 200);
  let result = await response.json();
  assert.equal(result.criteria.dteHorizon, 45);
  assert.equal(result.criteria.limit, 5);
  assert.equal(result.status, 'PARTIAL');
  assert.deepEqual(result.candidates.map(row => row.symbol), ['AAA']);
  assert.ok(result.excluded.some(row => row.symbol === 'BBB' && row.reason.includes('Veto')));
  assert.equal(Object.keys(result.candidates[0].cores).length, 7);
  const individual = await (await post({ ...criteria, activeCores: ['001'] })).json();
  assert.ok(individual.excluded.some(row => row.symbol === 'BBB' && row.reason.includes('Veto')));
  assert.equal(individual.candidates[0].cores['002'].active, false);
  assert.equal(calls, 1);
  phase = 'GOOD';
  tick += 100_000;
  result = await (await post(criteria)).json();
  assert.deepEqual(result.candidates.map(row => row.symbol), ['AAA', 'CCC']);
  phase = 'VETO';
  tick += 100_000;
  response = await post(criteria);
  result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.status, 'COMPLETE');
  assert.equal(result.candidates.length, 0);
  phase = 'DOWN';
  tick += 100_000;
  assert.equal((await post(criteria)).status, 503);
  assert.throws(() => parseScreenerInput({ ...criteria, activeCores: ['001', '001'] }), /Selecciona cores/);
});

test('la ruta pública del escáner valida el cuerpo original antes de inyectar contextos heredados', async t => {
  const { default: app } = await import('../src/app.js');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign({ username: 'prueba', dbTarget: 'supabase' }, config.JWT_SECRET, { expiresIn: '5m' });
  const response = await fetch(`${origin}/api/v2/strategy-screener/run`, { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-broker-selection': 'ALPACA',
  }, body: JSON.stringify({ ...criteria, limit: 0 }) });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /limit/);
});

test('cada core informa su participación: confluencia con peso efectivo, filtro, dependencia, síntesis o no calculado', async () => {
  const run = createStrategyScreener({ universe: [{ symbol: 'AAA', companyName: 'AAA' }, { symbol: 'BBB', companyName: 'BBB' }], now: () => asOf,
    edgar: { issuerIndex: async () => new Map(), holdingsReport: async () => ({ evidence: observed }), reportedHoldings: () => ({}),
      statements: async symbol => financial(symbol === 'BBB' ? 'MARGINAL' : 'VIABLE') },
    marketData: { obtenerSesionBursatil: async () => ({}), obtenerPrecioSubyacente: async () => stock,
      obtenerHistorialVelas: async () => history(), obtenerFechaResultados: async () => earnings, obtenerCadenaOpciones: async () => chain(),
      obtenerNoticiasAccion: async () => ({ articles: [], evidence: observed }), obtenerFlujoOpciones: async () => [{ contract: chain().contracts[0],
        trades: [{ price: 2, size: 2, side: null }], evidence: observed }] },
  });
  const roles = cores => Object.fromEntries(Object.entries(cores).map(([id, core]) => [id, core.role]));

  const todos = (await run(criteria)).candidates[0].cores;
  assert.deepEqual(roles(todos), { '001': 'CONFLUENCE', '002': 'CONFLUENCE', '003': 'CONFLUENCE', '004': 'GATE',
    '005': 'CONFLUENCE', '006': 'CONFLUENCE', '007': 'SYNTHESIS' });
  assert.equal(todos['001'].effectiveWeight, 0.225);
  assert.equal(todos['002'].effectiveWeight, 0.25);
  const pesos = Object.values(todos).filter(core => core.role === 'CONFLUENCE').reduce((suma, core) => suma + core.effectiveWeight, 0);
  assert.ok(Math.abs(pesos - 1) < 1e-9);
  for (const id of ['004', '007']) assert.equal('effectiveWeight' in todos[id], false);

  const senales = (await run({ ...criteria, activeCores: ['003'] })).candidates[0].cores;
  assert.deepEqual(roles(senales), { '001': 'DEPENDENCY', '002': 'GATE', '003': 'CONFLUENCE', '004': 'GATE',
    '005': 'NOT_COMPUTED', '006': 'NOT_COMPUTED', '007': 'SYNTHESIS' });
  assert.equal('effectiveWeight' in senales['001'], false);
  assert.equal(senales['003'].effectiveWeight, 1);

  const vetada = (await run({ ...criteria, activeCores: ['006'] })).excluded.find(row => row.symbol === 'BBB').cores;
  assert.equal(vetada['002'].role, 'GATE');
  assert.equal(vetada['004'].role, 'NOT_COMPUTED');
  assert.equal(vetada['001'].role, 'NOT_COMPUTED');
});

test('cada empresa excluida informa su tipo de exclusión: veto, sin collar o datos insuficientes', async () => {
  const universe = ['VET', 'SIN', 'DAT', 'BUE'].map(symbol => ({ symbol, companyName: symbol }));
  const run = createStrategyScreener({ universe, now: () => asOf,
    edgar: { issuerIndex: async () => new Map(), holdingsReport: async () => ({ evidence: observed }), reportedHoldings: () => ({}),
      statements: async symbol => financial(symbol === 'VET' ? 'MARGINAL' : 'VIABLE') },
    marketData: { obtenerSesionBursatil: async () => ({}), obtenerPrecioSubyacente: async () => stock,
      obtenerHistorialVelas: async symbol => {
        if (symbol === 'DAT') throw new SourceError('Alpaca', 'Serie 1Day incompleta.');
        return history();
      },
      obtenerFechaResultados: async () => earnings,
      obtenerCadenaOpciones: async symbol => {
        const data = chain();
        if (symbol === 'SIN') data.contracts[0].interest = 0;
        return data;
      },
      obtenerNoticiasAccion: async () => ({ articles: [], evidence: observed }), obtenerFlujoOpciones: async () => [] },
  });
  const result = await run({ ...criteria, activeCores: ['001'] });
  const tipos = Object.fromEntries(result.excluded.map(row => [row.symbol, row.exclusionType]));
  assert.deepEqual(tipos, { VET: 'VIABILITY_VETO', SIN: 'NO_COLLAR', DAT: 'INSUFFICIENT_DATA' });
  assert.ok(result.excluded.every(row => row.reason));
  assert.deepEqual(result.candidates.map(row => row.symbol), ['BUE']);
  assert.equal('exclusionType' in result.candidates[0], false);
});

test('sin fecha de earnings la empresa conserva su posición con riesgo UNVERIFIED y el 003 se abstiene', async () => {
  let calendario = 'CAIDO';
  const run = createStrategyScreener({ universe: [{ symbol: 'AAA', companyName: 'AAA' }], now: () => asOf + (calendario === 'CAIDO' ? 0 : 100_000),
    edgar: { issuerIndex: async () => new Map(), holdingsReport: async () => ({ evidence: observed }), reportedHoldings: () => ({}),
      statements: async () => financial('VIABLE') },
    marketData: { obtenerSesionBursatil: async () => ({}), obtenerPrecioSubyacente: async () => stock,
      obtenerHistorialVelas: async () => history(),
      obtenerFechaResultados: async () => {
        if (calendario === 'CAIDO') throw new SourceError('Webull OpenAPI · Financial Alerts', 'Webull no entregó una fecha de resultados utilizable.');
        return earnings;
      },
      obtenerCadenaOpciones: async () => chain(), obtenerNoticiasAccion: async () => ({ articles: [], evidence: observed }),
      obtenerFlujoOpciones: async () => [{ contract: chain().contracts[0], trades: [{ price: 2, size: 2, side: null }], evidence: observed }] },
  });
  let result = await run(criteria);
  assert.equal(result.status, 'PARTIAL');
  const [fila] = result.candidates;
  assert.equal(fila?.symbol, 'AAA');
  assert.equal(fila.partial, true);
  assert.equal(fila.cores['002'].result.risk, 'UNVERIFIED');
  assert.match(fila.cores['002'].result.event.reason, /fecha de resultados utilizable/);
  assert.equal(fila.cores['002'].result.event.start, null);
  assert.equal(fila.cores['002'].status, 'PARTIAL');
  assert.ok(Number.isFinite(fila.cores['002'].score));
  assert.deepEqual([fila.cores['003'].result.signal, fila.cores['003'].result.rule, fila.cores['003'].status], ['HOLD', 'EVENT_UNVERIFIED', 'PARTIAL']);
  assert.equal(JSON.stringify(fila).includes('Financial Alerts ('), false);
  assert.equal(Object.values(fila.cores).flatMap(core => core.evidence).some(e => /Financial Alerts/.test(e.source)), false);

  calendario = 'CON_FECHA';
  result = await run(criteria);
  assert.equal(result.candidates[0].cores['002'].result.risk, 'LOW');
  assert.equal(result.candidates[0].cores['002'].result.event.start, '2027-01-20');
});

test('el calendario de resultados no inventa fechas cuando Webull no entrega una', async prueba => {
  const original = { ...config };
  Object.assign(config, { WEBULL_APP_KEY: 'app', WEBULL_APP_SECRET: 'secreto' });
  prueba.after(() => Object.assign(config, original));
  const { obtenerFechaResultados } = await import('../src/api/v2/services/strategyScreener/marketData.js');
  let respuesta = {};
  prueba.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => respuesta }));
  await assert.rejects(obtenerFechaResultados('AAPL', asOf), error => error instanceof SourceError && /fecha de resultados/.test(error.reason));
  respuesta = { start_date: '2027-01-20', end_date: '2027-01-21' };
  const fecha = await obtenerFechaResultados('AAPL', asOf);
  assert.equal(fecha.start, '2027-01-20');
  assert.doesNotMatch(fecha.evidence.source, /Estimado/);
});
