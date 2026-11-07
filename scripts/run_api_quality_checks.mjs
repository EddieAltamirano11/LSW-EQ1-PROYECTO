import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync, fork } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'docs/evidencias-pruebas-api');
fs.mkdirSync(output, { recursive: true });
const startedAt = new Date().toISOString();
const testFiles = fs.readdirSync(path.join(root, 'test')).filter(name => name.endsWith('.test.js')).sort();
const suites = [];
console.log('PRUEBAS DE CALIDAD DE API EN ENTORNO LOCAL');
for (const file of testFiles) {
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `test/${file}`], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } });
  const raw = `${run.stdout || ''}${run.stderr || ''}`;
  const logFile = file.replace('.test.js', '.tap.txt'); fs.writeFileSync(path.join(output, logFile), raw);
  const cases = [...raw.matchAll(/^(ok|not ok) \d+ - (.+)$/gm)].map(match => ({ name: match[2], passed: match[1] === 'ok' }));
  const suite = { file: `test/${file}`, exitCode: run.status, passed: cases.filter(item => item.passed).length, failed: cases.filter(item => !item.passed).length, cases, logFile, error: run.error?.message || null };
  suites.push(suite); console.log(`${run.status === 0 ? 'PASS' : 'FAIL'} ${file}: ${suite.passed} aprobadas, ${suite.failed} fallidas`);
}

const child = fork(path.join(root, 'scripts/helpers/api-quality-server.mjs'), [], { cwd: root, silent: true });
let serverLog = '';
child.stdout.on('data', chunk => { serverLog += chunk.toString(); });
child.stderr.on('data', chunk => { serverLog += chunk.toString(); });
let report;
try {
  const ready = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('El servidor de pruebas no inició en 15 segundos')), 15000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Servidor terminó antes de iniciar: ${code}`)); });
    child.once('message', message => { clearTimeout(timeout); resolve(message); });
  });
  const origin = ready.origin; assert.ok(origin.startsWith('http://127.0.0.1:'));
  const allowed = new Set(['/', '/api/v1/health', '/api/v1/spec.json', '/api/v1/docs', '/api/v1/auth/login', '/api/v1/auth/session', '/api/v1/quant/black-scholes', '/api/v1/preflight/readiness']);
  const request = async (endpoint, options = {}) => {
    assert.ok(allowed.has(endpoint), `Ruta excluida de la auditoría: ${endpoint}`);
    const started = performance.now();
    const response = await fetch(`${origin}${endpoint}`, { ...options, signal: AbortSignal.timeout(10000) });
    const text = await response.text(); let body;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 100); }
    return { status: response.status, elapsedMs: performance.now() - started, headers: Object.fromEntries(response.headers), body };
  };
  const quoteOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spotPrice: 100, strikePrice: 100, timeToExpirationYears: 1 }) };
  const snapshot = async () => {
    const pending = once(child, 'message'); child.send('snapshot');
    const [message] = await pending; return message;
  };
  const smoke = [];
  for (const endpoint of ['/api/v1/health', '/api/v1/spec.json', '/api/v1/docs']) {
    const result = await request(endpoint);
    const contentValid = endpoint.endsWith('/health') ? result.body.status === 'UP' : endpoint.endsWith('spec.json') ? result.body.openapi === '3.0.3' : result.headers['content-type']?.includes('text/html');
    smoke.push({ endpoint, status: result.status, elapsedMs: result.elapsedMs, passed: result.status === 200 && contentValid });
  }
  const quote = await request('/api/v1/quant/black-scholes', quoteOptions);
  smoke.push({ endpoint: '/api/v1/quant/black-scholes', status: quote.status, elapsedMs: quote.elapsedMs, passed: quote.status === 200 && quote.body.theoreticalPrice === 5.7858, response: quote.body });

  for (let i = 0; i < 20; i++) await request('/api/v1/quant/black-scholes', quoteOptions);
  const load = [];
  for (const [concurrency, requests] of [[1, 40], [5, 100], [20, 400], [50, 500], [100, 1000]]) {
    const before = await snapshot(); const latencies = []; let errors = 0; let next = 0;
    const started = performance.now();
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (next++ < requests) {
        const began = performance.now();
        try { const result = await request('/api/v1/quant/black-scholes', quoteOptions); if (result.status !== 200 || result.body.theoreticalPrice !== 5.7858) errors++; }
        catch { errors++; }
        latencies.push(performance.now() - began);
      }
    }));
    const elapsedMs = performance.now() - started; const after = await snapshot();
    latencies.sort((a, b) => a - b);
    const percentile = p => latencies[Math.max(0, Math.ceil(latencies.length * p) - 1)];
    const phase = { concurrency, requests, completed: latencies.length, errors, elapsedMs, requestsPerSecond: requests / (elapsedMs / 1000), p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99), maxMs: latencies.at(-1), serverRssMiB: after.memory.rss / 1048576, serverCpuMs: (after.cpu.user + after.cpu.system - before.cpu.user - before.cpu.system) / 1000, passed: errors === 0 && percentile(0.95) < 1000 };
    load.push(phase); console.log(`CARGA c=${concurrency} n=${requests} errores=${errors} p95=${phase.p95Ms.toFixed(2)}ms rps=${phase.requestsPerSecond.toFixed(1)}`);
  }

  const synthetic = [];
  for (let cycle = 1; cycle <= 5; cycle++) {
    const began = performance.now();
    const health = await request('/api/v1/health');
    const login = await request('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'synthetic', password: 'local-only', databaseTarget: 'supabase' }) });
    const session = await request('/api/v1/auth/session', { headers: { Authorization: `Bearer ${login.body.token}` } });
    const calculation = await request('/api/v1/quant/black-scholes', quoteOptions);
    const resource = await snapshot();
    const sample = { cycle, timestamp: new Date().toISOString(), healthStatus: health.status, sessionStatus: session.status, calculationStatus: calculation.status, activeDatabase: session.body.activeDatabase, elapsedMs: performance.now() - began, uptimeSeconds: health.body.uptime, rssMiB: resource.memory.rss / 1048576, passed: health.status === 200 && session.status === 200 && session.body.activeDatabase === 'supabase' && calculation.body.theoreticalPrice === 5.7858 };
    synthetic.push(sample);
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  // Son observaciones de seguridad y monitoreo, no pruebas que oculten defectos.
  const anonymous = await request('/api/v1/auth/session');
  const demoLogin = await request('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'cuenta-inexistente-audit', password: 'cualquier-valor', databaseTarget: 'mongodb' }) });
  const descriptor = await request('/');
  const readiness = await request('/api/v1/preflight/readiness');
  const findings = [
    { id: 'H01', category: 'Seguridad', observation: 'La sesión anónima devuelve AUTHENTICATED', status: anonymous.status, evidence: anonymous.body, confirmed: anonymous.status === 200 && anonymous.body.status === 'AUTHENTICATED' && anonymous.body.user?.role === 'ANONYMOUS' },
    { id: 'H02', category: 'Seguridad', observation: 'El login de demostración acepta credenciales arbitrarias no vacías', status: demoLogin.status, evidence: { tokenIssued: typeof demoLogin.body.token === 'string', activeDatabase: demoLogin.body.activeDatabase }, confirmed: demoLogin.status === 200 && typeof demoLogin.body.token === 'string' },
    { id: 'H03', category: 'Monitoreo', observation: 'La raíz anuncia ambas BD conectadas sin abrir conexiones durante esta ejecución', status: descriptor.status, evidence: descriptor.body.databases, confirmed: descriptor.body.databases?.mongodb === 'CONNECTED' && descriptor.body.databases?.supabase === 'CONNECTED' },
    { id: 'H04', category: 'Monitoreo', observation: 'La ruta de readiness anunciada no está implementada', status: readiness.status, evidence: { advertised: descriptor.body.preflight }, confirmed: readiness.status === 404 },
    { id: 'H05', category: 'Seguridad', observation: 'CORS permite cualquier origen', status: quote.status, evidence: { allowOrigin: quote.headers['access-control-allow-origin'] }, confirmed: quote.headers['access-control-allow-origin'] === '*' },
    { id: 'H06', category: 'Analítica', observation: 'No se observó limitación de tasa en la carga local de Black Scholes', evidence: { requests: load.reduce((sum, item) => sum + item.requests, 0), errors: load.reduce((sum, item) => sum + item.errors, 0), sourceReview: 'No existe middleware de rate limiting en src/app.js ni dependencia en package.json' }, confirmed: load.every(item => item.errors === 0) },
  ];
  const sourceFiles = ['src/app.js', 'src/api/v1/routes/index.js', 'src/middlewares/auth.middleware.js', 'src/middlewares/databaseContext.middleware.js', 'src/api/v1/services/auth.service.js', 'src/api/v1/services/quant.service.js', ...testFiles.map(file => `test/${file}`)];
  report = { startedAt, finishedAt: new Date().toISOString(), environment: { node: process.version, platform: os.platform(), release: os.release(), architecture: os.arch(), cpuModel: os.cpus()[0]?.model, logicalCpus: os.cpus().length, systemMemoryGiB: os.totalmem() / 1073741824, target: origin, apiBase: '/api/v1', mode: 'local sin conexiones a bases ni operaciones bursátiles' }, suites, totals: { passed: suites.reduce((sum, suite) => sum + suite.passed, 0), failed: suites.reduce((sum, suite) => sum + suite.failed, 0) }, smoke, load, synthetic, findings, sourceHashes: Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')])) };
  fs.writeFileSync(path.join(output, 'resultados.json'), JSON.stringify(report, null, 2));
} finally {
  child.send?.('close');
  const exitTimer = setTimeout(() => child.kill(), 3000);
  await once(child, 'exit'); clearTimeout(exitTimer);
  fs.writeFileSync(path.join(output, 'servidor-local.txt'), serverLog.replace(/\u001b\[[0-9;]*m/g, ''));
}
if (report) {
  const passed = suites.every(suite => suite.exitCode === 0) && report.smoke.every(item => item.passed) && report.load.every(item => item.passed) && report.synthetic.every(item => item.passed);
  console.log(`RESULTADO ${passed ? 'PASS' : 'FAIL'}: ${report.totals.passed} pruebas aprobadas, ${report.totals.failed} fallidas; ${report.findings.filter(item => item.confirmed).length} hallazgos registrados por separado.`);
  console.log(`Evidencia: ${path.relative(root, output)}/resultados.json`);
  if (!passed) process.exitCode = 1;
}
