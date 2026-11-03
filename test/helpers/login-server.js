import { once } from 'node:events';

export async function startLoginServer(apiBase = '/api/v1') {
  process.env.API_URL = apiBase;
  process.env.JWT_SECRET = 'login-tests-only-secret';
  const { default: app } = await import('../../src/app.js');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  };
}
