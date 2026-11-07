import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import config from '../src/config/config.js';
import { startLoginServer } from './helpers/login-server.js';

let server;
before(async () => { server = await startLoginServer(); });
after(async () => { await server?.close(); });
const input = { spotPrice: 100, strikePrice: 100, timeToExpirationYears: 1 };
async function post(path, body) { return fetch(`${server.origin}/api/v1${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }

test('[contrato] las referencias internas del OpenAPI publicado se resuelven', async () => {
  const response = await fetch(`${server.origin}/api/v1/spec.json`);
  assert.equal(response.status, 200); const spec = await response.json();
  assert.equal(spec.openapi, '3.0.3'); let references = 0;
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) {
      assert.ok(value.$ref.startsWith('#/'));
      const target = value.$ref.slice(2).split('/').reduce((node, part) => node?.[part.replace(/~1/g, '/').replace(/~0/g, '~')], spec);
      assert.notEqual(target, undefined, value.$ref); references++;
    }
    Object.values(value).forEach(visit);
  }
  visit(spec); assert.ok(references > 0);
});

test('[contrato] respuesta Black Scholes cumple los campos y tipos del consumidor', async () => {
  // Contrato explícito del consumidor para esta operación. No es Pact ni un
  // validador completo de OpenAPI, cuyas respuestas carecen de schema aquí.
  const response = await post('/quant/black-scholes', input);
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /application\/json/);
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ['message', 'spotPrice', 'strikePrice', 'timeToExpirationYears', 'riskFreeRate', 'volatility', 'optionType', 'theoreticalPrice', 'greeks'].sort());
  assert.equal(typeof body.message, 'string'); assert.equal(body.optionType, 'PUT');
  for (const key of ['spotPrice', 'strikePrice', 'timeToExpirationYears', 'riskFreeRate', 'volatility', 'theoreticalPrice']) assert.equal(typeof body[key], 'number');
  assert.deepEqual(Object.keys(body.greeks).sort(), ['delta', 'gamma', 'theta', 'vega', 'rho'].sort());
  assert.ok(Object.values(body.greeks).every(Number.isFinite));
});

test('[contrato] error de entrada cumple el contrato de error y el estado documentado', async () => {
  const spec = await (await fetch(`${server.origin}/api/v1/spec.json`)).json();
  const response = await post('/quant/black-scholes', { ...input, spotPrice: 0 });
  assert.equal(response.status, 400); assert.ok(spec.paths['/quant/black-scholes'].post.responses['400']);
  const body = await response.json();
  for (const field of ['error', 'message', 'timestamp', 'path', 'activeDatabase']) assert.equal(typeof body[field], 'string');
  assert.equal(body.statusCode, 400); assert.equal(body.path, '/api/v1/quant/black-scholes');
  assert.ok(Number.isFinite(Date.parse(body.timestamp)));
});

test('[funcional] cliente inicia sesión confirma contexto y calcula precio', async () => {
  for (const databaseTarget of ['mongodb', 'supabase']) {
    const login = await post('/auth/login', { username: 'audit-client', password: 'solo-pruebas', databaseTarget });
    assert.equal(login.status, 200); const data = await login.json();
    const headers = { Authorization: `Bearer ${data.token}`, 'Content-Type': 'application/json' };
    const session = await fetch(`${server.origin}/api/v1/auth/session`, { headers });
    assert.equal(session.status, 200); assert.equal((await session.json()).activeDatabase, databaseTarget);
    const quote = await fetch(`${server.origin}/api/v1/quant/black-scholes`, { method: 'POST', headers, body: JSON.stringify(input) });
    assert.equal(quote.status, 200); assert.equal(quote.headers.get('x-active-database'), databaseTarget);
    assert.equal((await quote.json()).theoreticalPrice, 5.7858);
  }
});

for (const [name, tokenFactory] of [
  ['expirado', () => jwt.sign({ sub: 'expired' }, config.JWT_SECRET, { expiresIn: -1 })],
  ['firma incorrecta', () => jwt.sign({ sub: 'forged' }, `${config.JWT_SECRET}-wrong`)],
  ['algoritmo none', () => jwt.sign({ sub: 'unsigned' }, '', { algorithm: 'none' })],
]) {
  test(`[seguridad] rechaza JWT con ${name}`, async () => {
    const response = await fetch(`${server.origin}/api/v1/auth/session`, { headers: { Authorization: `Bearer ${tokenFactory()}` } });
    assert.equal(response.status, 401); const body = await response.json();
    assert.equal(body.user, undefined); assert.equal(body.stack, undefined); assert.equal(body.token, undefined);
  });
}

test('[seguridad] rechaza objeto de inyección en parámetro numérico', async () => {
  const response = await post('/quant/black-scholes', { ...input, spotPrice: { $gt: 0 } });
  assert.equal(response.status, 400); assert.match((await response.json()).message, /spotPrice/);
});

test('[seguridad] JSON truncado produce 400 sin exponer stack', async () => {
  const response = await fetch(`${server.origin}/api/v1/quant/black-scholes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"spotPrice":' });
  assert.equal(response.status, 400); assert.equal((await response.json()).stack, undefined);
});

test('[smoke] health documentación y cálculo responden con contenido esperado', async () => {
  const health = await fetch(`${server.origin}/api/v1/health`);
  assert.equal(health.status, 200); const data = await health.json();
  assert.equal(data.status, 'UP'); assert.ok(data.uptime > 0); assert.ok(Number.isFinite(Date.parse(data.timestamp)));
  const docs = await fetch(`${server.origin}/api/v1/docs`);
  assert.equal(docs.status, 200); assert.match(docs.headers.get('content-type'), /text\/html/); await docs.arrayBuffer();
  const quote = await post('/quant/black-scholes', input);
  assert.equal(quote.status, 200); assert.equal((await quote.json()).theoreticalPrice, 5.7858);
});
