import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startLoginServer } from './helpers/login-server.js';

// Referencias HTTP capturadas antes del cambio, en abcae86.
const input = { spotPrice: 100, strikePrice: 100, timeToExpirationYears: 1 };
const message = 'Valuación analítica Black-Scholes y Griegas calculadas.';
const expectedPut = {
  message, ...input, riskFreeRate: 0.045, volatility: 0.2, optionType: 'PUT',
  theoreticalPrice: 5.7858,
  greeks: { delta: -0.3726, gamma: 0.018921, theta: -0.0051, vega: 0.3784, rho: -0.4304 },
};
const expectedCall = {
  message, ...input, riskFreeRate: 0.05, volatility: 0.2, optionType: 'CALL',
  theoreticalPrice: 10.4506,
  greeks: { delta: 0.6368, gamma: 0.018762, theta: -0.0176, vega: 0.3752, rho: 0.5323 },
};

let server;
// El prefijo alternativo también verifica que la validación no fija /api/v1.
const apiBase = '/pruebas/v2';
before(async () => { server = await startLoginServer(apiBase); });
after(async () => { await server?.close(); });

async function post(body, endpoint = '/quant/black-scholes') {
  const response = await fetch(`${server.origin}${apiBase}${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function assertBadRequest(body, field) {
  const result = await post(body);
  assert.equal(result.status, 400, JSON.stringify(body));
  assert.equal(result.body.statusCode, 400);
  assert.equal(result.body.error, 'Bad Request');
  assert.ok(result.body.message.includes(field), result.body.message);
  assert.equal(result.body.path, `${apiBase}/quant/black-scholes`);
  assert.equal(result.body.activeDatabase, 'mongodb');
  assert.ok(Number.isFinite(Date.parse(result.body.timestamp)));
  assert.equal(result.body.theoreticalPrice, undefined);
}

test('conserva exactamente el PUT y sus valores predeterminados en otro prefijo', async () => {
  const result = await post(input);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, expectedPut);
});

test('conserva exactamente el CALL explícito y sus cinco griegas', async () => {
  const result = await post({ ...input, riskFreeRate: 0.05, volatility: 0.2, optionType: 'CALL' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, expectedCall);
});

test('conserva cadenas numéricas, minúsculas y tolerancia de metadatos adicionales', async () => {
  for (const [optionType, expected] of [['put', expectedPut], ['call', expectedCall]]) {
    const result = await post({
      spotPrice: ' 100 ', strikePrice: '1e2', timeToExpirationYears: '1',
      riskFreeRate: String(expected.riskFreeRate), volatility: '0.2', optionType,
      metadata: { origen: 'prueba' },
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, expected);
  }
});

test('admite tasas cero y negativas finitas con resultados representables', async () => {
  for (const riskFreeRate of [0, -0.01]) {
    const result = await post({ ...input, riskFreeRate });
    assert.equal(result.status, 200);
    assert.equal(result.body.riskFreeRate, riskFreeRate);
    assert.ok(Number.isFinite(result.body.theoreticalPrice));
    assert.ok(Object.values(result.body.greeks).every(Number.isFinite));
  }
});

test('rechaza cuerpos que no sean objetos de parámetros', async () => {
  await assertBadRequest([], 'cuerpo');
  await assertBadRequest({}, 'spotPrice');
});

for (const field of ['spotPrice', 'strikePrice', 'timeToExpirationYears']) {
  test(`rechaza la ausencia de ${field}`, async () => {
    const body = { ...input };
    delete body[field];
    await assertBadRequest(body, field);
  });
}

for (const field of ['spotPrice', 'strikePrice', 'timeToExpirationYears', 'volatility', 'riskFreeRate']) {
  test(`rechaza valores no numéricos y coerciones inválidas en ${field}`, async () => {
    for (const value of [null, true, false, [], [100], {}, '', '  ', 'abc', 'NaN', 'Infinity']) {
      await assertBadRequest({ ...input, [field]: value }, field);
    }
  });
}

for (const field of ['spotPrice', 'strikePrice', 'timeToExpirationYears', 'volatility']) {
  test(`rechaza cero y negativos en ${field}`, async () => {
    for (const value of [0, -1, '0', '-0.1']) {
      await assertBadRequest({ ...input, [field]: value }, field);
    }
  });
}

test('rechaza números JSON que desbordan a infinito', async () => {
  const response = await fetch(`${server.origin}${apiBase}/quant/black-scholes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: '{"spotPrice":1e999,"strikePrice":100,"timeToExpirationYears":1}',
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /spotPrice/);
});

test('rechaza optionType nulo, no textual o desconocido con un error de entrada', async () => {
  for (const optionType of [null, 1, true, [], {}, '', 'STOCK']) {
    await assertBadRequest({ ...input, optionType }, 'optionType');
  }
});

test('rechaza resultados no finitos en lugar de responder cálculos null', async () => {
  await assertBadRequest({ ...input, riskFreeRate: -1e308 }, 'rango numérico');
});

test('conserva la respuesta existente de volatilidad implícita', async () => {
  const result = await post({ ...input, marketPrice: 5.7858 }, '/quant/implied-volatility');
  assert.equal(result.status, 200);
  assert.equal(result.body.impliedVolatility, 0.2);
  assert.equal(result.body.converged, true);
  assert.equal(result.body.marketPrice, 5.7858);
});

test('publica el contrato Black-Scholes con sus valores predeterminados y error 400', async () => {
  const response = await fetch(`${server.origin}${apiBase}/spec.json`);
  assert.equal(response.status, 200);
  const spec = await response.json();
  const endpoint = spec.paths['/quant/black-scholes'].post;
  assert.ok(endpoint.responses['400']);
  const schema = endpoint.requestBody.content['application/json'].schema;
  assert.deepEqual(schema.required, ['spotPrice', 'strikePrice', 'timeToExpirationYears']);
  assert.equal(schema.properties.optionType.default, 'PUT');
  assert.equal(schema.properties.volatility.default, 0.2);
  assert.equal(schema.properties.riskFreeRate.default, 0.045);
});
