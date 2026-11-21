import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import express from 'express';
import { startLoginServer } from './helpers/login-server.js';
import { errorHandler } from '../src/middlewares/errorHandler.middleware.js';
import { crearRutasEscaner } from '../src/api/v2/routes/scanner.routes.js';
import { crearEscaner, MARKET_BASKET } from '../src/api/v2/services/scanner.service.js';

// Proveedor de cotizaciones de prueba (sin red): precios por símbolo; un símbolo ausente simula un broker sin cotización.
let precios = {};
const cotizar = async simbolo => {
  if (!(simbolo in precios)) throw new Error(`Sin cotización de ${simbolo}`);
  return { lastPrice: precios[simbolo], companyName: null, timestamp: '2026-11-20T20:59:00.000Z', source: 'Broker de prueba' };
};
const todos = () => Object.fromEntries(MARKET_BASKET.map((activo, i) => [activo.symbol, 100 + i * 37]));

let server;
let escaner;
before(async () => {
  server = await startLoginServer('/api/v1');
  const app = express();
  // Un escáner nuevo por solicitud: cada prueba ve los precios que define, sin la caché de 60 s de otra prueba.
  app.use('/api/v2/market/scanner', (req, res, next) => crearRutasEscaner(crearEscaner({ cotizar }))(req, res, next));
  app.use(errorHandler);
  escaner = app.listen(0, '127.0.0.1');
  await once(escaner, 'listening');
});
after(async () => {
  await server?.close();
  escaner?.close();
});

async function get(path, origen = `http://127.0.0.1:${escaner.address().port}`) {
  const response = await fetch(`${origen}${path}`);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch (_) {
    body = text;
  }
  return { status: response.status, body };
}
const getApp = path => get(path, server.origin);

test('[v2-scanner] GET /api/v2/market/scanner/top-collars responde 200 con 5 candidatos por defecto', async () => {
  precios = todos();
  const result = await get('/api/v2/market/scanner/top-collars');
  assert.equal(result.status, 200);
  assert.ok(result.body.timestamp);
  assert.equal(result.body.criteria.limit, 5);
  assert.equal(result.body.criteria.sortBy, 'probability');
  assert.equal(result.body.criteria.dteHorizon, 45);
  assert.equal(result.body.candidates.length, 5);

  const first = result.body.candidates[0];
  assert.equal(first.rank, 1);
  assert.ok(first.symbol);
  assert.ok(first.spotPrice > 0);
  assert.ok(first.putFloor.strike > 0);
  assert.ok(first.callCeiling.strike > first.putFloor.strike);
  assert.ok(first.probabilities.floorProtectionPct >= 0 && first.probabilities.floorProtectionPct <= 100);
  assert.ok(first.probabilities.sweetSpotPct >= 0 && first.probabilities.sweetSpotPct <= 100);
  assert.ok(first.tradingViewSymbol.includes(':'));
});

test('[v2-scanner] permite solicitar 10 candidatos con limit=10', async () => {
  const result = await get('/api/v2/market/scanner/top-collars?limit=10');
  assert.equal(result.status, 200);
  assert.equal(result.body.candidates.length, 10);
  assert.equal(result.body.candidates[9].rank, 10);
});

test('[v2-scanner] ordena correctamente por mayor crédito neto (sortBy=netCredit)', async () => {
  const result = await get('/api/v2/market/scanner/top-collars?limit=5&sortBy=netCredit');
  assert.equal(result.status, 200);
  assert.equal(result.body.criteria.sortBy, 'netCredit');
  const items = result.body.candidates;
  for (let i = 0; i < items.length - 1; i++) {
    assert.ok(
      items[i].financialMetrics.netDebitCredit >= items[i + 1].financialMetrics.netDebitCredit,
      `Inconsistencia de ordenamiento: ${items[i].financialMetrics.netDebitCredit} < ${items[i + 1].financialMetrics.netDebitCredit}`
    );
  }
});

test('[v2-scanner] ordena correctamente por mayor retorno potencial (sortBy=maxReturn)', async () => {
  const result = await get('/api/v2/market/scanner/top-collars?limit=5&sortBy=maxReturn');
  assert.equal(result.status, 200);
  assert.equal(result.body.criteria.sortBy, 'maxReturn');
  const items = result.body.candidates;
  for (let i = 0; i < items.length - 1; i++) {
    assert.ok(
      items[i].financialMetrics.maxReturnPct >= items[i + 1].financialMetrics.maxReturnPct
    );
  }
});

test('[v2-scanner] admite horizonte temporal de 30 y 60 días', async () => {
  for (const dte of [30, 60]) {
    const result = await get(`/api/v2/market/scanner/top-collars?dteHorizon=${dte}`);
    assert.equal(result.status, 200);
    assert.equal(result.body.criteria.dteHorizon, dte);
    assert.equal(result.body.candidates[0].dteDays, dte);
  }
});

test('[v2-scanner] rechaza parámetros de consulta inválidos con 400 Bad Request', async () => {
  const badLimit = await get('/api/v2/market/scanner/top-collars?limit=99');
  assert.equal(badLimit.status, 400);

  const badSort = await get('/api/v2/market/scanner/top-collars?sortBy=arbitrario');
  assert.equal(badSort.status, 400);

  const badDte = await get('/api/v2/market/scanner/top-collars?dteHorizon=90');
  assert.equal(badDte.status, 400);
});

test('[v2-scanner] GET /api/v2/market/scanner/company-criteria devuelve los 4 pilares de selección', async () => {
  const result = await getApp('/api/v2/market/scanner/company-criteria');
  assert.equal(result.status, 200);
  assert.equal(result.body.strategyName, 'Collar Spread (Zero-Cost Protective Collar)');
  assert.equal(result.body.selectionPillars.length, 4);
  const ids = result.body.selectionPillars.map((p) => p.pillarId);
  assert.ok(ids.includes('P01_TENDENCIA_TECNICA'));
  assert.ok(ids.includes('P02_LIQUIDEZ_DERIVADOS'));
  assert.ok(ids.includes('P03_VOLATILIDAD_MODERADA'));
  assert.ok(ids.includes('P04_CALENDARIO_CORPORATIVO'));
});

test('[v2-scanner] GET /api/v2/market/scanner/tradingview/:symbol devuelve configuración válida de widgets', async () => {
  const result = await getApp('/api/v2/market/scanner/tradingview/NVDA');
  assert.equal(result.status, 200);
  assert.equal(result.body.symbol, 'NVDA');
  assert.equal(result.body.tvSymbol, 'NASDAQ:NVDA');
  assert.ok(result.body.chartConfig);
  assert.ok(result.body.technicalAnalysisConfig);
});

test('[v2-core] GET /api/v2/health devuelve estado UP y versión v2.0.0', async () => {
  const result = await getApp('/api/v2/health');
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'UP');
  assert.equal(result.body.version, 'v2.0.0');
  assert.ok(result.body.capabilities.includes('SCANNER_TOP_COLLARS_PROBABILITY'));
});

test('[v2-core] ruta alias /api/v2/scanner/top-collars es equivalente', async () => {
  const alias = await getApp('/api/v2/scanner/company-criteria');
  const oficial = await getApp('/api/v2/market/scanner/company-criteria');
  assert.equal(alias.status, 200);
  assert.deepEqual(alias.body, oficial.body);
});

test('[v2-scanner] un activo sin cotización va a unavailable con su motivo y sin precio de referencia', async () => {
  precios = todos();
  delete precios.AAPL;
  const result = await get('/api/v2/market/scanner/top-collars?limit=25');
  assert.equal(result.status, 200);
  assert.equal(result.body.candidates.some(c => c.symbol === 'AAPL'), false);
  const aapl = result.body.unavailable.find(u => u.symbol === 'AAPL');
  assert.match(aapl.reason, /Sin cotización de AAPL/);
  assert.equal(JSON.stringify(result.body).includes('227.5'), false);
});

test('[v2-scanner] responde 503 cuando el broker no cotiza ningún activo', async () => {
  precios = {};
  const result = await get('/api/v2/market/scanner/top-collars');
  assert.equal(result.status, 503);
  assert.match(result.body.message, /ningún activo/);
});

test('[v2-scanner] un ticker añadido sin cotización va a unavailable y no recibe precio 100', async () => {
  precios = todos();
  let result = await get('/api/v2/market/scanner/top-collars?limit=25&extraSymbols=ZZZZ');
  assert.equal(result.body.candidates.some(c => c.symbol === 'ZZZZ'), false);
  assert.ok(result.body.unavailable.some(u => u.symbol === 'ZZZZ'));
  precios.ZZZZ = 52.5;
  result = await get('/api/v2/market/scanner/top-collars?limit=25&extraSymbols=ZZZZ');
  const zzzz = result.body.candidates.find(c => c.symbol === 'ZZZZ');
  assert.equal(zzzz.spotPrice, 52.5);
  assert.equal(zzzz.companyName, null);
  assert.match(zzzz.pricing.volatilitySource, /declarad/i);
});

test('[v2-scanner] las primas son teóricas, con el modelo y la volatilidad supuesta, y sin technicalOutlook', async () => {
  precios = todos();
  const result = await get('/api/v2/market/scanner/top-collars?limit=3');
  for (const candidato of result.body.candidates) {
    assert.ok(candidato.putFloor.theoreticalPremium > 0 && candidato.callCeiling.theoreticalPremium > 0);
    assert.equal('marketPremium' in candidato.putFloor, false);
    assert.equal('marketPremium' in candidato.callCeiling, false);
    assert.deepEqual([candidato.pricing.model, candidato.pricing.theoretical], ['BLACK_SCHOLES', true]);
    assert.ok(candidato.pricing.volatility > 0 && candidato.pricing.riskFreeRate > 0 && candidato.pricing.volatilitySource);
    for (const campo of ['technicalOutlook', 'technicalSummary', 'rsi14', 'aboveSma200', 'referenceSpot']) {
      assert.equal(campo in candidato, false, campo);
    }
    assert.equal(candidato.spotObservedAt, '2026-11-20T20:59:00.000Z');
    assert.equal(candidato.spotSource, 'Broker de prueba');
  }
  for (const activo of MARKET_BASKET) {
    for (const campo of ['referenceSpot', 'rsi14', 'aboveSma200']) assert.equal(campo in activo, false, `${activo.symbol}.${campo}`);
  }
});

test('[v2-scanner] la caché de 60 s guarda solo cotizaciones válidas', async () => {
  const escanear = crearEscaner({ cotizar });
  precios = todos();
  delete precios.MSFT;
  let result = await escanear({ limit: 25 });
  assert.ok(result.unavailable.some(u => u.symbol === 'MSFT'));
  precios.MSFT = 480;
  precios.AAPL = 1;
  result = await escanear({ limit: 25 });
  assert.equal(result.candidates.find(c => c.symbol === 'MSFT').spotPrice, 480, 'el fallo no quedó en caché');
  assert.equal(result.candidates.find(c => c.symbol === 'AAPL').spotPrice, 100, 'la cotización válida sí quedó en caché');
});
