// Servidor exclusivo de la auditoría local. No ejecuta src/index.js ni conecta BD.
process.env.API_URL = '/api/v1';
process.env.JWT_SECRET = 'api-quality-local-tests-only';
const { default: app } = await import('../../src/app.js');
const server = app.listen(0, '127.0.0.1', () => {
  process.send?.({ type: 'ready', origin: `http://127.0.0.1:${server.address().port}` });
});
process.on('message', message => {
  if (message === 'snapshot') process.send?.({ type: 'snapshot', memory: process.memoryUsage(), cpu: process.cpuUsage(), uptime: process.uptime() });
  if (message === 'close') server.close(() => process.exit(0));
});
process.on('disconnect', () => server.close(() => process.exit(0)));
