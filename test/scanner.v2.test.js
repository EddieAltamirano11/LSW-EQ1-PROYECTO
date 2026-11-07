import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startLoginServer } from './helpers/login-server.js';

let server;
before(async () => {
  server = await startLoginServer('/api/v1');
});
after(async () => {
  await server?.close();
});

async function get(path) {
  const response = await fetch(`${server.origin}${path}`);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch (_) {
    body = text;
  }
  return { status: response.status, body };
}

test('[v2-scanner] GET /api/v2/market/scanner/top-collars responde 200 con 5 candidatos por defecto', async () => {
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
  const badLimit = await get('/api/v2/market/scanner/top-collars?limit=25');
  assert.equal(badLimit.status, 400);

  const badSort = await get('/api/v2/market/scanner/top-collars?sortBy=arbitrario');
  assert.equal(badSort.status, 400);

  const badDte = await get('/api/v2/market/scanner/top-collars?dteHorizon=90');
  assert.equal(badDte.status, 400);
});

test('[v2-scanner] GET /api/v2/market/scanner/company-criteria devuelve los 4 pilares de selección', async () => {
  const result = await get('/api/v2/market/scanner/company-criteria');
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
  const result = await get('/api/v2/market/scanner/tradingview/NVDA');
  assert.equal(result.status, 200);
  assert.equal(result.body.symbol, 'NVDA');
  assert.equal(result.body.tvSymbol, 'NASDAQ:NVDA');
  assert.ok(result.body.chartConfig);
  assert.ok(result.body.technicalAnalysisConfig);
});

test('[v2-core] GET /api/v2/health devuelve estado UP y versión v2.0.0', async () => {
  const result = await get('/api/v2/health');
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'UP');
  assert.equal(result.body.version, 'v2.0.0');
  assert.ok(result.body.capabilities.includes('SCANNER_TOP_COLLARS_PROBABILITY'));
});

test('[v2-core] ruta alias /api/v2/scanner/top-collars es equivalente', async () => {
  const alias = await get('/api/v2/scanner/top-collars?limit=3');
  assert.equal(alias.status, 200);
  assert.equal(alias.body.candidates.length, 3);
});
