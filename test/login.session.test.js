import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startLoginServer } from './helpers/login-server.js';

let server;
before(async () => { server = await startLoginServer(); });
after(async () => { await server?.close(); });

async function login(databaseTarget) {
  return fetch(`${server.origin}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'demo', password: ' contraseña de prueba ', databaseTarget }),
  });
}

for (const database of ['mongodb', 'supabase']) {
  test(`login y sesión conservan ${database} desde el JWT sin sobrescribir el destino`, async () => {
    const response = await login(database);
    assert.equal(response.status, 200);
    // El middleware también reconoce databaseTarget en el cuerpo del login.
    assert.equal(response.headers.get('x-active-database'), database);
    const body = await response.json();
    assert.equal(body.activeDatabase, database);
    assert.equal(typeof body.token, 'string');
    assert.deepEqual(body.user, { userId: 'usr-demo', username: 'demo', role: 'INVESTOR' });

    const sessionResponse = await fetch(`${server.origin}/api/v1/auth/session`, {
      headers: { Authorization: `Bearer ${body.token}` },
    });
    assert.equal(sessionResponse.status, 200);
    assert.equal(sessionResponse.headers.get('x-active-database'), database);
    const session = await sessionResponse.json();
    assert.equal(session.status, 'AUTHENTICATED');
    assert.equal(session.activeDatabase, database);
    assert.equal(session.user.dbTarget, database);
    assert.equal(session.user.username, 'demo');
  });
}

test('los clientes existentes pueden sobrescribir el JWT con un encabezado válido', async () => {
  const body = await (await login('supabase')).json();
  const response = await fetch(`${server.origin}/api/v1/auth/session`, {
    headers: { Authorization: `Bearer ${body.token}`, 'x-database-selection': 'mongodb' },
  });
  const session = await response.json();
  assert.equal(response.status, 200);
  assert.equal(session.activeDatabase, 'mongodb');
  assert.equal(session.user.dbTarget, 'supabase');
});

test('conserva MongoDB y el acceso anónimo predeterminados de la API', async () => {
  const response = await fetch(`${server.origin}/api/v1/auth/session`);
  assert.equal(response.status, 200);
  const session = await response.json();
  assert.equal(session.activeDatabase, 'mongodb');
  assert.deepEqual(session.user, { role: 'ANONYMOUS' });
});

test('rechaza un Bearer inválido sin devolver un usuario confirmado', async () => {
  const response = await fetch(`${server.origin}/api/v1/auth/session`, {
    headers: { Authorization: 'Bearer token-invalido-para-prueba' },
  });
  assert.equal(response.status, 401);
  const error = await response.json();
  assert.equal(error.statusCode, 401);
  assert.equal(error.user, undefined);
});
