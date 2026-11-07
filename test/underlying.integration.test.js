import assert from 'node:assert/strict';
import { after, before, test, mock } from 'node:test';
import { getUnderlyingRepo } from '../src/api/v1/repositories/underlying.repository.js';
import { startLoginServer } from './helpers/login-server.js';

let server;
before(async () => { server = await startLoginServer(); });
after(async () => { await server?.close(); });

// Se integra HTTP + middleware + controlador + servicio. Únicamente el repositorio
// se sustituye en cada prueba. No representa una conexión a MongoDB o Supabase.
for (const database of ['mongodb', 'supabase']) {
  test(`[integración] CRUD HTTP con repositorio en memoria para ${database}`, async (t) => {
    const repo = getUnderlyingRepo(database); const rows = new Map();
    t.mock.method(repo, 'getBySymbol', mock.fn(async symbol => [...rows.values()].find(row => row.symbol === symbol) || null));
    t.mock.method(repo, 'create', mock.fn(async body => { const row = { ...body, id: 'AUDIT-01' }; rows.set(row.id, row); return row; }));
    t.mock.method(repo, 'getById', mock.fn(async id => rows.get(id) || null));
    t.mock.method(repo, 'update', mock.fn(async (id, changes) => { const row = rows.get(id); if (!row) return null; Object.assign(row, changes); return row; }));
    t.mock.method(repo, 'delete', mock.fn(async id => { const row = rows.get(id); rows.delete(id); return row || null; }));
    const headers = { 'Content-Type': 'application/json', 'x-database-selection': database };
    const url = `${server.origin}/api/v1/underlyings`;
    const created = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ symbol: 'AUDIT', companyName: 'Fixture', spotPrice: 100 }) });
    assert.equal(created.status, 201); assert.equal(created.headers.get('x-active-database'), database);
    assert.equal((await created.json()).id, 'AUDIT-01');
    const read = await fetch(`${url}/AUDIT-01`, { headers });
    assert.equal(read.status, 200); assert.equal((await read.json()).spotPrice, 100);
    const update = await fetch(`${url}/AUDIT-01`, { method: 'PUT', headers, body: JSON.stringify({ spotPrice: 105 }) });
    assert.equal(update.status, 200); assert.equal((await update.json()).spotPrice, 105);
    const deleted = await fetch(`${url}/AUDIT-01`, { method: 'DELETE', headers });
    assert.equal(deleted.status, 200); await deleted.arrayBuffer();
    const missing = await fetch(`${url}/AUDIT-01`, { headers });
    assert.equal(missing.status, 404); assert.equal((await missing.json()).statusCode, 404);
    assert.equal(repo.create.mock.callCount(), 1);
  });
}

test('[integración] duplicado devuelve 409 sin llamar a create', async (t) => {
  const repo = getUnderlyingRepo('mongodb');
  t.mock.method(repo, 'getBySymbol', async () => ({ id: 'existing', symbol: 'AUDIT' }));
  t.mock.method(repo, 'create', async () => { throw new Error('No debe persistir'); });
  const response = await fetch(`${server.origin}/api/v1/underlyings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: 'AUDIT' }) });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, 'Conflict');
  assert.equal(repo.create.mock.callCount(), 0);
});

test('[integración] fallo de repositorio llega al manejador de errores como 500', async (t) => {
  t.mock.method(getUnderlyingRepo('mongodb'), 'getAll', async () => { throw new Error('Fallo sintético del repositorio'); });
  const response = await fetch(`${server.origin}/api/v1/underlyings`);
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.statusCode, 500); assert.equal(body.path, '/api/v1/underlyings');
  assert.equal(body.stack, undefined);
});
