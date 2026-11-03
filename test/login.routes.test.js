import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { startLoginServer } from './helpers/login-server.js';

let server;
before(async () => { server = await startLoginServer(); });
after(async () => { await server?.close(); });

test('publica /login sin token con el prefijo configurado', async () => {
  const response = await fetch(`${server.origin}/login`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(html, /data-api-base="\/api\/v1"/);
  assert.doesNotMatch(html, /__LOGIN_API_BASE__/);
});

test('publica CSS, JavaScript e imagen, sin exponer la plantilla como recurso', async () => {
  for (const [file, contentType] of [['login.css', /text\/css/], ['login.js', /javascript/], ['investment-charts.png', /image\/png/]]) {
    const response = await fetch(`${server.origin}/login/assets/${file}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), contentType);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
  assert.equal((await fetch(`${server.origin}/login/assets/index.html`)).status, 404);
});

test('conserva el descriptor, Scalar y el contrato JSON de la API', async () => {
  const descriptor = await fetch(`${server.origin}/api/v1`);
  assert.equal(descriptor.status, 200);
  assert.equal((await descriptor.json()).status, 'ONLINE');
  const docs = await fetch(`${server.origin}/api/v1/docs`);
  assert.equal(docs.status, 200);
  assert.match(docs.headers.get('content-type'), /text\/html/);
  const spec = await fetch(`${server.origin}/api/v1/spec.json`);
  assert.equal(spec.status, 200);
  assert.ok((await spec.json()).paths['/auth/login']);
});

test('respeta un prefijo alternativo para la página y el flujo de sesión', async () => {
  const script = `
    import assert from 'node:assert/strict';
    import { startLoginServer } from './test/helpers/login-server.js';
    const server = await startLoginServer('/servicios/v2');
    try {
      const html = await (await fetch(server.origin + '/login')).text();
      assert.match(html, /data-api-base="\\/servicios\\/v2"/);
      const login = await fetch(server.origin + '/servicios/v2/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo', password: 'demo', databaseTarget: 'supabase' }),
      });
      assert.equal(login.status, 200);
      const data = await login.json();
      const session = await fetch(server.origin + '/servicios/v2/auth/session', {
        headers: { Authorization: 'Bearer ' + data.token },
      });
      assert.equal((await session.json()).activeDatabase, 'supabase');
    } finally { await server.close(); }
  `;
  await promisify(execFile)(process.execPath, ['--input-type=module', '-e', script], {
    cwd: new URL('../', import.meta.url), timeout: 15000,
  });
});

test('escapa el prefijo de API al insertarlo en un atributo HTML', async () => {
  const { default: config } = await import('../src/config/config.js');
  const original = config.API_URL;
  try {
    config.API_URL = '/api/"<>&\'';
    const html = await (await fetch(`${server.origin}/login`)).text();
    assert.match(html, /data-api-base="\/api\/&quot;&lt;&gt;&amp;&#39;"/);
    assert.doesNotMatch(html, /data-api-base="\/api\/"<>&/);
  } finally { config.API_URL = original; }
});
