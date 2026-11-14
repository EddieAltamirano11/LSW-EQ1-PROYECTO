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
import { confluenceCore, newsCore, SOURCE_CORES } from '../src/api/v2/services/strategyScreener/confluenceCores.js';

const asOf = Date.parse('2026-11-12T22:00:00Z');
const observed = observation('Fuente controlada', '2026-11-12T21:00:00Z', 'Observación de prueba');
const criteria = { mode: 'BY_STRATEGY', strategy: 'COLLAR_SPREAD', activeCores: SOURCE_CORES };
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
  const news = newsCore({ evidence: observed, articles: [article, { ...article, id: 2 }] }, asOf);
  assert.equal(news.result.observed, 1);
  assert.equal(news.result.sentiment, 'POSITIVE');
  assert.equal(newsCore({ evidence: observed, articles: [] }, asOf).result.sentiment, 'NEUTRAL');
  assert.equal(newsCore(null, asOf).status, 'UNAVAILABLE');
});

test('007 combina pesos sin tratar 001 y 003 como confirmaciones independientes', () => {
  const cores = Object.fromEntries(SOURCE_CORES.map(id => [id, available({}, [observed], { score: 80, confidence: 1, direction: 1 })]));
  for (const id of SOURCE_CORES) {
    const result = confluenceCore([id], cores, asOf).result;
    assert.equal(result.mode, 'INDIVIDUAL');
    assert.equal(result.signal, null);
    assert.equal(result.score, 80);
  }
  assert.equal(confluenceCore(['001', '003'], cores, asOf).result.signal, 'HOLD');
  assert.equal(confluenceCore(['001', '006'], cores, asOf).result.signal, 'BUY');
  cores['006'].direction = -1;
  const result = confluenceCore(['001', '006'], cores, asOf).result;
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
    marketData: { marketSession: async () => { calls++; return {}; }, stockSpot: async () => stock,
      stockHistory: async () => history(), earnings: async () => earnings, optionsChain: async () => successful(),
      stockNews: async () => ({ articles: [], evidence: observed }), optionFlow: async () => [{ contract: chain().contracts[0],
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
