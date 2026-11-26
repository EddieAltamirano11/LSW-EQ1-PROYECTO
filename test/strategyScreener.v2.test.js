import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import config from '../src/config/config.js';
import { authMiddleware } from '../src/middlewares/auth.middleware.js';
import { errorHandler } from '../src/middlewares/errorHandler.middleware.js';
import { strategyScreenerRoutes } from '../src/api/v2/routes/strategyScreener.routes.js';
import { createStrategyScreener, parseScreenerInput } from '../src/api/v2/services/strategyScreener.service.js';
import { createAiAnalysis } from '../src/api/v2/services/strategyScreener/aiAnalysis.js';
import { createAiProvider, createGeminiProvider, createOpenAiProvider } from '../src/api/v2/services/strategyScreener/aiProvider.js';
import { available, observation, SourceError } from '../src/api/v2/services/strategyScreener/observations.js';
import { technicalCore, directSignalsCore } from '../src/api/v2/services/strategyScreener/technicalCore.js';
import { eventRisk, fundamentalCore } from '../src/api/v2/services/strategyScreener/fundamentalCore.js';
import { institutionalCore, strategyCore } from '../src/api/v2/services/strategyScreener/optionsCores.js';
import { calcularCoreConfluencia, calcularCoreNoticias, CORES_SELECCIONABLES } from '../src/api/v2/services/strategyScreener/confluenceCores.js';

const asOf = Date.parse('2026-11-12T22:00:00Z');
const observed = observation('Fuente controlada', '2026-11-12T21:00:00Z', 'Observación de prueba');
const criteria = { mode: 'BY_STRATEGY', strategy: 'COLLAR_SPREAD', activeCores: CORES_SELECCIONABLES };
const stock = { price: 100, evidence: observed };
const earnings = { start: '2027-01-20', end: '2027-01-21', estimated: true, evidence: observed };

function financial(scenario) {
  const prior = { end: '2025-09-30', assets: 1000, currentAssets: 600, currentLiabilities: 200, liabilities: 500,
    equity: 500, retained: 260, cash: 280, longDebt: 200, currentDebt: 50, shortDebt: 0,
    revenue: 1800, gross: 600, operating: 330, net: 300, cashFlow: 340, interest: null, eps: 10, shares: 100 };
  const current = { ...prior, end: '2026-09-30', revenue: 2000, gross: 750, operating: 400, net: 360, cashFlow: 440 };
  if (scenario === 'MARGINAL') current.cashFlow = -100;
  if (scenario === 'NO_VIABLE') Object.assign(current, { retained: -1600, equity: -500, operating: -800, liabilities: 1500 });
  if (scenario === 'UNKNOWN') current.retained = null;
  return { years: [current, prior], cik: '0012345678', sic: 3571, evidence: [observed], references: [] };
}

function history(direction = 1, lastVolume = 300) {
  const bars = Array.from({ length: 80 }, (_, i) => ({
    at: asOf - (80 - i) * 3600000, open: 100 + direction * i * 0.1,
    high: 100.2 + direction * i * 0.1, low: 99.9 + direction * i * 0.1,
    close: 100.1 + direction * i * 0.1, volume: i === 79 ? lastVolume : 100,
  }));
  if (direction > 0) Object.assign(bars.at(-1), { high: 110, close: 109 });
  return { series: { '1Day': bars, '1Hour': bars, '15Min': bars }, evidence: [observed] };
}

function chain() {
  const base = { underlying: 'TEST', expiration: '2026-12-24', bid: 2, ask: 2.2,
    multiplier: 100, standard: true, volume: 100, interest: 80, gamma: 0.04, delay: 15, at: asOf - 3600000 };
  return { target: Date.parse(base.expiration), evidence: [observed], contracts: [
    { ...base, symbol: 'TEST261224P00095000', type: 'put', strike: 95 },
    { ...base, symbol: 'TEST261224C00105000', type: 'call', strike: 105 },
  ] };
}

test('Core de IA conserva el orden de sus sugerencias, los riesgos opcionales y el ranking cuantitativo', async t => {
  const universe = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE'].map(symbol => ({ symbol }));
  const statements = [];
  const run = createStrategyScreener({
    universe, now: () => asOf,
    edgar: {
      issuerIndex: async () => new Map(),
      statements: async symbol => {
        statements.push(symbol);
        return financial(symbol === 'CCC' ? 'MARGINAL' : 'VIABLE');
      },
    },
    marketData: {
      obtenerSesionBursatil: async () => ({}),
      obtenerPrecioSubyacente: async () => stock,
      obtenerFechaResultados: async symbol => symbol === 'BBB' ? null
        : { ...earnings, evidence: { ...observed, source: 'Calendario verificado' } },
      obtenerCadenaOpciones: async symbol => symbol === 'DDD' ? { ...chain(), contracts: [] } : chain(),
    },
  });
  const inputs = [];
  let invalidCitation = false;
  const prepare = createGeminiProvider({
    apiKey: () => 'clave-gemini-de-pruebas',
    model: () => 'gemini-3.1-flash-lite',
    request: async (_url, options) => {
      const requestBody = JSON.parse(options.body);
      const input = JSON.parse(requestBody.contents[0].parts[0].text);
      inputs.push(input);
      const assets = input.scope === 'CANDIDATES' ? [...input.assets].reverse() : input.assets;
      const result = { recommendations: assets.map(({ symbol }) => ({
        symbol, verdict: input.scope === 'SYMBOL' ? 'WAIT' : 'CONSIDER',
        reasons: [{ text: 'La viabilidad es favorable.', evidenceId: `${symbol}/fundamental` }],
        risks: symbol === 'EEE' ? [] : [
          { text: 'El costo del collar afecta el resultado.', evidenceId: invalidCitation ? 'XXX/collar' : `${symbol}/collar` },
          { text: 'Si el precio sube mucho, el collar puede limitar lo que ganas.', evidenceId: null },
        ],
      })) };
      return Response.json({
        modelVersion: 'gemini-3.1-flash-lite',
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(result) }] } }],
      });
    },
  });
  const analyze = createAiAnalysis({ run, prepare });
  const app = express();
  app.use(express.json(), authMiddleware, strategyScreenerRoutes(run, undefined, analyze), errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign({ user: 'Identidad de prueba' }, config.JWT_SECRET, { expiresIn: '5m' });
  const post = (path, body, auth = true) => fetch(`${base}/${path}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body) });
  const ai = { activeCores: ['002'], dteHorizon: 60 };
  const selected = { ...ai, scope: 'SYMBOL', symbol: 'zzz' };
  assert.equal((await post('ai-analysis', selected, false)).status, 401);
  assert.equal((await post('ai-analysis', { ...selected, evidence: [] })).status, 400);
  assert.equal((await post('ai-analysis', { ...selected, symbol: 'ZZ1' })).status, 400);
  assert.deepEqual(statements, []);

  const individual = await (await post('ai-analysis', selected)).json();
  assert.deepEqual(statements, ['ZZZ']);
  assert.equal(individual.dteHorizon, 60);
  assert.equal(individual.model, 'gemini-3.1-flash-lite');
  assert.equal(individual.recommendations[0].verdict, 'WAIT');
  assert.equal(individual.recommendations[0].evidence[0].sources[0].observedAt, observed.observedAt);
  assert.ok(!JSON.stringify(inputs[0]).includes('Identidad de prueba'));

  const baseline = { ...criteria, ...ai, limit: 25 };
  const before = await (await post('run', baseline)).json();
  assert.deepEqual(before.candidates.map(row => row.symbol), ['AAA', 'BBB', 'EEE']);
  const suggestions = await (await post('ai-analysis', { ...ai, scope: 'CANDIDATES' })).json();
  assert.deepEqual(inputs[1].assets.map(row => row.symbol), ['AAA', 'EEE']);
  assert.deepEqual(suggestions.recommendations.map(row => row.symbol), ['EEE', 'AAA']);
  assert.ok(suggestions.recommendations.every(row => row.verdict === 'CONSIDER'));
  assert.deepEqual(suggestions.recommendations[0].risks, []);
  assert.equal(suggestions.recommendations[1].risks[0].evidenceId, 'AAA/collar');
  assert.equal(suggestions.recommendations[1].risks[1].evidenceId, null);
  assert.deepEqual(suggestions.recommendations[1].evidence.map(fact => fact.id), ['AAA/fundamental', 'AAA/collar']);
  for (const [symbol, verdict] of [['BBB', 'INSUFFICIENT_DATA'], ['CCC', 'AVOID'], ['DDD', 'AVOID'], ['SPY', 'INSUFFICIENT_DATA']]) {
    const result = await (await post('ai-analysis', { ...selected, symbol })).json();
    assert.equal(result.model, null);
    assert.equal(result.recommendations[0].verdict, verdict);
    assert.ok(result.recommendations[0].reasons[0].text);
  }
  assert.equal(inputs.length, 2);
  invalidCitation = true;
  assert.equal((await post('ai-analysis', selected)).status, 502);
  const after = await (await post('run', baseline)).json();
  assert.deepEqual(after, before);
});

test('cliente de OpenAI usa salida estructurada, maneja errores y limita las consultas', async () => {
  const matchesStatus = status => error => error.output?.statusCode === status;
  const notConfigured = createOpenAiProvider({ apiKey: () => '' });
  assert.throws(notConfigured, matchesStatus(503));
  let fixture;
  let timestamp = asOf;
  const prepare = createOpenAiProvider({
    apiKey: () => 'clave-de-pruebas',
    model: () => 'gpt-6-luna',
    now: () => timestamp,
    request: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      const body = JSON.parse(options.body);
      assert.equal(body.store, false);
      assert.equal(body.model, 'gpt-6-luna');
      assert.equal(body.text.format.strict, true);
      const points = body.text.format.schema.properties.recommendations.items.properties;
      assert.deepEqual(points.reasons.items.properties.evidenceId.type, ['string', 'null']);
      assert.deepEqual(JSON.parse(body.input), { scope: 'CANDIDATES' });
      return Response.json(fixture.data, { status: fixture.status });
    },
  });
  const complete = prepare();
  const input = { scope: 'CANDIDATES' };
  fixture = { status: 401, data: { error: 'Clave que no debe llegar al consumidor' } };
  await assert.rejects(complete(input), error => matchesStatus(503)(error) && !error.message.includes('Clave'));
  fixture = { status: 200, data: { status: 'incomplete', output: [null] } };
  await assert.rejects(complete(input), matchesStatus(502));
  fixture.data = { status: 'completed', output: [{ type: 'message',
    content: [{ type: 'output_text', text: '{"recommendations":[]}' }] }] };
  for (let i = 0; i < 10; i++) {
    assert.deepEqual(await complete(input), { model: 'gpt-6-luna', result: { recommendations: [] } });
  }
  await assert.rejects(complete(input), matchesStatus(429));
  timestamp += 60_000;
  assert.equal((await complete(input)).model, 'gpt-6-luna');
});

test('Gemini es el proveedor predeterminado y su cuota no activa llamadas a OpenAI', async t => {
  const previous = process.env.AI_PROVIDER;
  delete process.env.AI_PROVIDER;
  t.after(() => {
    if (previous === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previous;
  });
  const matchesStatus = status => error => error.output?.statusCode === status;
  assert.throws(createGeminiProvider({ apiKey: () => '' }),
    error => matchesStatus(503)(error) && error.message.includes('GEMINI_API_KEY'));

  let status = 429;
  let responseBody = { error: { message: 'Detalle reservado del proyecto' } };
  let geminiCalls = 0;
  let openaiCalls = 0;
  const input = { scope: 'CANDIDATES' };
  const prepare = createAiProvider({
    gemini: createGeminiProvider({
      apiKey: () => 'clave-gemini-de-pruebas',
      model: () => 'gemini-3.1-flash-lite',
      request: async (url, options) => {
        geminiCalls++;
        assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
        assert.equal(options.headers['x-goog-api-key'], 'clave-gemini-de-pruebas');
        const body = JSON.parse(options.body);
        const instructions = body.systemInstruction.parts[0].text;
        assert.match(instructions, /Collar Spread/);
        assert.match(instructions, /podría no convenir/);
        assert.match(instructions, /frase corta y cotidiana/);
        assert.match(instructions, /Puedes usar tu conocimiento general/);
        assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), input);
        assert.equal(body.generationConfig.responseMimeType, 'application/json');
        assert.deepEqual(body.generationConfig.responseJsonSchema.required, ['recommendations']);
        const points = body.generationConfig.responseJsonSchema.properties.recommendations.items.properties;
        assert.deepEqual(points.risks.items.properties.evidenceId.type, ['string', 'null']);
        return Response.json(responseBody, { status });
      },
    }),
    openai: () => async () => {
      openaiCalls++;
      return { model: 'gpt-6-luna', result: { recommendations: [] } };
    },
  });

  await assert.rejects(prepare()(input), error =>
    matchesStatus(429)(error) && error.message.includes('Gemini') && !error.message.includes('Detalle reservado'));
  assert.equal(geminiCalls, 1);
  assert.equal(openaiCalls, 0);

  status = 200;
  responseBody = { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"recommendations":[]}' }] } }] };
  await assert.rejects(prepare()(input), matchesStatus(502));
  responseBody.candidates[0].finishReason = 'STOP';
  responseBody.candidates[0].content.parts.unshift({ thought: true, text: 'Texto fuera del análisis' });
  assert.deepEqual(await prepare()(input), { model: 'gemini-3.1-flash-lite', result: { recommendations: [] } });

  process.env.AI_PROVIDER = 'openai';
  assert.equal((await prepare()(input)).model, 'gpt-6-luna');
  assert.equal(openaiCalls, 1);
  process.env.AI_PROVIDER = 'desconocido';
  assert.throws(prepare, matchesStatus(503));
  assert.equal(geminiCalls, 3);
});

test('001 combina temporalidades, requiere volumen en ruptura y expone la cobertura', () => {
  const trend = technicalCore(history());
  assert.equal(trend.result.trend, 'UP');
  assert.equal(trend.result.timeframes.intraday.breakout, 1);
  assert.equal(technicalCore(history(1, 100)).result.timeframes.intraday.breakout, 0);
  assert.equal(technicalCore({ series: {} }).status, 'UNAVAILABLE');
  assert.deepEqual(technicalCore(history()), trend);
});

test('002 distingue los cuatro estados y 003 aplica confirmación y riesgo', () => {
  const event = eventRisk(earnings, asOf);
  for (const scenario of ['VIABLE', 'MARGINAL', 'NO_VIABLE', 'UNKNOWN']) {
    assert.equal(fundamentalCore(financial(scenario), stock, event).result.classification, scenario);
  }
  assert.equal(directSignalsCore(technicalCore(history()), event).result.signal, 'BUY');
  assert.equal(directSignalsCore(technicalCore(history(-1)), event).result.signal, 'SELL');
  assert.equal(directSignalsCore(technicalCore(history()), available({ risk: 'HIGH' }, [observed])).result.signal, 'HOLD');
  assert.equal(directSignalsCore(null, event).status, 'UNAVAILABLE');
});

test('004 valora ask y bid observados y rechaza un par sin liquidez o entregables compatibles', () => {
  const result = strategyCore(stock, chain()).result;
  assert.equal(result.maxLoss, 520);
  assert.equal(result.maxProfit, 480);
  assert.equal(result.breakEven, 100.2);
  for (const changes of [{ interest: 0 }, { standard: false }, { expiration: '2026-12-31' }]) {
    const data = chain();
    Object.assign(data.contracts[0], changes);
    assert.equal(strategyCore(stock, data).result.eligible, false);
  }
});

test('005 respeta el lado observado y 006 distingue ventanas vacías de fallas', () => {
  const contract = chain().contracts[1];
  const trades = Array.from({ length: 3 }, () => ({ price: 2, size: 2, side: 'B' }));
  const data = [{ contract, trades, evidence: observed }];
  assert.equal(institutionalCore(data, {}, observed).result.direction, 'BULLISH');
  data[0].trades = trades.map(row => ({ ...row, side: null }));
  assert.equal(institutionalCore(data, {}, observed).result.direction, 'UNDETERMINED');
  const article = { id: 1, source: 'Fuente', headline: 'Company beats earnings estimates', symbols: ['TEST'], created_at: observed.observedAt };
  const news = calcularCoreNoticias({ evidence: observed, articles: [article, { ...article, id: 2 }] }, asOf);
  assert.equal(news.result.observed, 1);
  assert.equal(news.result.sentiment, 'POSITIVE');
  assert.equal(calcularCoreNoticias({ evidence: observed, articles: [] }, asOf).result.sentiment, 'NEUTRAL');
  assert.equal(calcularCoreNoticias(null, asOf).status, 'UNAVAILABLE');
});

test('006 reconoce contratos, caídas de servicio y fallos atribuibles al activo', () => {
  const microsoft = { symbol: 'MSFT', companyName: 'Microsoft Corporation' };
  const amazon = { symbol: 'AMZN', companyName: 'Amazon.com Inc.' };
  const cases = [
    [microsoft, 'Microsoft Secures 51MW Geothermal Energy Contract in New Zealand', '', 1],
    [microsoft, 'Microsoft is awarded a cloud contract', '', 1],
    [microsoft, 'Microsoft is negotiating a cloud contract', '', 0],
    [microsoft, 'Microsoft secures no cloud contract', '', 0],
    [microsoft, 'Microsoft signs a preliminary cloud contract', '', 0],
    [microsoft, 'Microsoft awarded a contract to Contoso', '', 0],
    [microsoft, 'Microsoft Declares “Code Red” Following Historic Outage', '', -1],
    [microsoft, 'Microsoft service disruption affects customers', '', -1],
    [microsoft, 'Microsoft reports disruption in contract negotiations', '', 0],
    [microsoft, 'Microsoft restores service after an outage', 'Microsoft suffered a major outage earlier today.', 0],
    [microsoft, 'Microsoft suffers a major outage', 'Microsoft services have been fully restored.', 0],
    [microsoft, 'Contoso suffers a major outage; Microsoft is monitoring it', '', 0],
    [amazon, 'Court Rules Against Amazon in Consumer Product Safety Act Litigation', '', -1],
    [amazon, 'Court rules against Amazon’s competitor', '', 0],
    [amazon, 'Court rules against Contoso in a case followed by Amazon', '', 0],
  ];
  for (const [activo, headline, summary, expectedDirection] of cases) {
    const articles = [{ headline, summary, symbols: [activo.symbol, 'CONTOSO'], created_at: observed.observedAt }];
    const { result } = calcularCoreNoticias({ evidence: observed, articles }, asOf, activo);
    assert.equal(Math.sign(result.headlines[0].impact), expectedDirection, headline);
  }
});

test('006 interpreta el cambio de precio objetivo con dirección explícita o dos importes', () => {
  const tesla = { symbol: 'TSLA', companyName: 'Tesla Inc.' };
  const amd = { symbol: 'AMD', companyName: 'Advanced Micro Devices, Inc.' };
  const cases = [
    [tesla, 'UBS Raises Price Target on Tesla to $430', '', 1],
    [tesla, 'UBS Cuts Price Target on Tesla to $430', '', -1],
    [tesla, 'UBS does not raise price target on Tesla', '', 0],
    [tesla, 'UBS may cut price target on Tesla', '', 0],
    [tesla, 'UBS may revise its price target for Tesla from $425 to $430', '', 0],
    [tesla, 'Tesla price target lowered to $430', '', -1],
    [tesla, 'UBS updates TSLA’s price target from $410.50 to $430.25', '', 1],
    [tesla, 'UBS Adjusts Price Target on Tesla to $430', 'UBS updated its price target for Tesla, increasing it from $425 to $430.', 1],
    [amd, 'BNP Paribas Adjusts Price Target for AMD', 'It revised its price target for Advanced Micro Devices, Inc. (AMD) to $650, down from its previous target of $960.', -1],
    [tesla, 'UBS Adjusts Price Target on Tesla to $430', '', 0],
    [tesla, 'UBS Adjusts Price Target on Tesla', 'It adjusted its price target for Tesla after revenue grew from $100 to $200.', 0],
    [tesla, 'UBS Adjusts Price Target on Tesla from $430 to $430', '', 0],
    [tesla, 'UBS Adjusts Price Target on Tesla from €410 to $430', '', 0],
    [tesla, 'UBS maintained its Buy rating and price target for Tesla', '', 0],
    [tesla, 'UBS raises its price target for MSFT and adjusts the price target for Tesla', '', 0],
  ];
  for (const [activo, headline, summary, expectedDirection] of cases) {
    const articles = [{ headline, summary, symbols: [activo.symbol], created_at: asOf }];
    const { result } = calcularCoreNoticias({ evidence: observed, articles }, asOf, activo);
    const { impact } = result.headlines[0];
    assert.equal(Math.sign(impact), expectedDirection, headline);
    if (summary && expectedDirection) assert.equal(Math.abs(impact), 0.3, headline);
  }
});

test('007 combina pesos sin tratar 001 y 003 como confirmaciones independientes', () => {
  const cores = Object.fromEntries(CORES_SELECCIONABLES.map(id => [id, available({}, [observed], { score: 80, confidence: 1, direction: 1 })]));
  for (const id of CORES_SELECCIONABLES) {
    const result = calcularCoreConfluencia([id], cores, asOf).result;
    assert.equal(result.mode, 'INDIVIDUAL');
    assert.equal(result.signal, null);
    assert.equal(result.score, 80);
  }
  assert.equal(calcularCoreConfluencia(['001', '003'], cores, asOf).result.signal, 'HOLD');
  assert.equal(calcularCoreConfluencia(['001', '006'], cores, asOf).result.signal, 'BUY');
  cores['006'].direction = -1;
  const result = calcularCoreConfluencia(['001', '006'], cores, asOf).result;
  assert.equal(result.signal, 'HOLD');
  assert.ok(result.confidence < 0.95);
  assert.ok(result.conflicts.length);
  assert.equal(result.drivers.reduce((sum, value) => sum + value.weight, 0), 1);
});

test('ruta autenticada entrega resultados completos y parciales, veta, valida y reporta 503', async t => {
  const universe = ['CCC', 'AAA', 'BBB'].map(symbol => ({ symbol, companyName: `${symbol} Technologies Inc.` }));
  const successful = () => chain();
  let phase = 'PARTIAL';
  let calls = 0;
  let tick = asOf;
  const run = createStrategyScreener({ universe, now: () => tick,
    edgar: { issuerIndex: async () => new Map(), holdingsReport: async () => ({ evidence: observed }), reportedHoldings: () => ({}),
      statements: async symbol => {
        if (phase === 'DOWN' || (phase === 'PARTIAL' && symbol === 'CCC')) throw new SourceError('SEC', 'Sin estados financieros.');
        return financial(phase === 'VETO' || symbol === 'BBB' ? 'MARGINAL' : 'VIABLE');
      } },
    marketData: { obtenerSesionBursatil: async () => { calls++; return {}; }, obtenerPrecioSubyacente: async () => stock,
      obtenerHistorialVelas: async () => history(), obtenerFechaResultados: async () => earnings, obtenerCadenaOpciones: async () => successful(),
      obtenerNoticiasAccion: async symbol => ({ evidence: observed,
        articles: [{ headline: `${symbol} Technologies secures a cloud contract`, symbols: [symbol], created_at: observed.observedAt }] }),
      obtenerFlujoOpciones: async () => [{ contract: chain().contracts[0],
        trades: [{ price: 2, size: 2, side: null }], evidence: observed }] },
  });
  const app = express();
  app.use(express.json(), authMiddleware);
  app.use('/api/v2/strategy-screener', strategyScreenerRoutes(run));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/api/v2/strategy-screener/run`;
  const token = jwt.sign({ user: 'Pruebas de escáner' }, config.JWT_SECRET, { expiresIn: '5m' });
  const post = (body, auth = token) => fetch(url, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(auth && { Authorization: `Bearer ${auth}` }),
  }, body: JSON.stringify(body) });
  assert.equal((await post(criteria, '')).status, 401);
  assert.equal((await post({ ...criteria, activeCores: ['004'] })).status, 400);
  assert.equal((await post({ ...criteria, limit: 1.5 })).status, 400);
  assert.equal(calls, 0);
  let response = await post(criteria);
  assert.equal(response.status, 200);
  let result = await response.json();
  assert.equal(result.criteria.dteHorizon, 45);
  assert.equal(result.criteria.limit, 5);
  assert.equal(result.status, 'PARTIAL');
  assert.deepEqual(result.candidates.map(row => row.symbol), ['AAA']);
  assert.ok(result.excluded.some(row => row.symbol === 'BBB' && row.reason.includes('Veto')));
  assert.equal(Object.keys(result.candidates[0].cores).length, 7);
  assert.equal(result.candidates[0].cores['006'].result.sentiment, 'POSITIVE');
  assert.equal(result.candidates[0].cores['006'].result.classifier, 'Reglas de lenguaje financiero EN v3');
  const individual = await (await post({ ...criteria, activeCores: ['001'] })).json();
  assert.ok(individual.excluded.some(row => row.symbol === 'BBB' && row.reason.includes('Veto')));
  assert.equal(individual.candidates[0].cores['002'].active, false);
  assert.equal(calls, 1);
  phase = 'GOOD';
  tick += 100_000;
  result = await (await post(criteria)).json();
  assert.deepEqual(result.candidates.map(row => row.symbol), ['AAA', 'CCC']);
  phase = 'VETO';
  tick += 100_000;
  response = await post(criteria);
  result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.status, 'COMPLETE');
  assert.equal(result.candidates.length, 0);
  phase = 'DOWN';
  tick += 100_000;
  assert.equal((await post(criteria)).status, 503);
  assert.throws(() => parseScreenerInput({ ...criteria, activeCores: ['001', '001'] }), /Selecciona cores/);
});

test('la ruta pública del escáner valida el cuerpo original antes de inyectar contextos heredados', async t => {
  const { default: app } = await import('../src/app.js');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign({ username: 'prueba', dbTarget: 'supabase' }, config.JWT_SECRET, { expiresIn: '5m' });
  const response = await fetch(`${origin}/api/v2/strategy-screener/run`, { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-broker-selection': 'ALPACA',
  }, body: JSON.stringify({ ...criteria, limit: 0 }) });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /limit/);
});

test('cada core informa su participación: confluencia con peso efectivo, filtro, dependencia, síntesis o no calculado', async () => {
  const run = createStrategyScreener({ universe: [{ symbol: 'AAA', companyName: 'AAA' }, { symbol: 'BBB', companyName: 'BBB' }], now: () => asOf,
    edgar: { issuerIndex: async () => new Map(), holdingsReport: async () => ({ evidence: observed }), reportedHoldings: () => ({}),
      statements: async symbol => financial(symbol === 'BBB' ? 'MARGINAL' : 'VIABLE') },
    marketData: { obtenerSesionBursatil: async () => ({}), obtenerPrecioSubyacente: async () => stock,
      obtenerHistorialVelas: async () => history(), obtenerFechaResultados: async () => earnings, obtenerCadenaOpciones: async () => chain(),
      obtenerNoticiasAccion: async () => ({ articles: [], evidence: observed }), obtenerFlujoOpciones: async () => [{ contract: chain().contracts[0],
        trades: [{ price: 2, size: 2, side: null }], evidence: observed }] },
  });
  const roles = cores => Object.fromEntries(Object.entries(cores).map(([id, core]) => [id, core.role]));

  const todos = (await run(criteria)).candidates[0].cores;
  assert.deepEqual(roles(todos), { '001': 'CONFLUENCE', '002': 'CONFLUENCE', '003': 'CONFLUENCE', '004': 'GATE',
    '005': 'CONFLUENCE', '006': 'CONFLUENCE', '007': 'SYNTHESIS' });
  assert.equal(todos['001'].effectiveWeight, 0.225);
  assert.equal(todos['002'].effectiveWeight, 0.25);
  const pesos = Object.values(todos).filter(core => core.role === 'CONFLUENCE').reduce((suma, core) => suma + core.effectiveWeight, 0);
  assert.ok(Math.abs(pesos - 1) < 1e-9);
  for (const id of ['004', '007']) assert.equal('effectiveWeight' in todos[id], false);

  const senales = (await run({ ...criteria, activeCores: ['003'] })).candidates[0].cores;
  assert.deepEqual(roles(senales), { '001': 'DEPENDENCY', '002': 'GATE', '003': 'CONFLUENCE', '004': 'GATE',
    '005': 'NOT_COMPUTED', '006': 'NOT_COMPUTED', '007': 'SYNTHESIS' });
  assert.equal('effectiveWeight' in senales['001'], false);
  assert.equal(senales['003'].effectiveWeight, 1);

  const vetada = (await run({ ...criteria, activeCores: ['006'] })).excluded.find(row => row.symbol === 'BBB').cores;
  assert.equal(vetada['002'].role, 'GATE');
  assert.equal(vetada['004'].role, 'NOT_COMPUTED');
  assert.equal(vetada['001'].role, 'NOT_COMPUTED');
});

test('cada empresa excluida informa su tipo de exclusión: veto, sin collar o datos insuficientes', async () => {
  const universe = ['VET', 'SIN', 'DAT', 'BUE'].map(symbol => ({ symbol, companyName: symbol }));
  const run = createStrategyScreener({ universe, now: () => asOf,
    edgar: { issuerIndex: async () => new Map(), holdingsReport: async () => ({ evidence: observed }), reportedHoldings: () => ({}),
      statements: async symbol => financial(symbol === 'VET' ? 'MARGINAL' : 'VIABLE') },
    marketData: { obtenerSesionBursatil: async () => ({}), obtenerPrecioSubyacente: async () => stock,
      obtenerHistorialVelas: async symbol => {
        if (symbol === 'DAT') throw new SourceError('Alpaca', 'Serie 1Day incompleta.');
        return history();
      },
      obtenerFechaResultados: async () => earnings,
      obtenerCadenaOpciones: async symbol => {
        const data = chain();
        if (symbol === 'SIN') data.contracts[0].interest = 0;
        return data;
      },
      obtenerNoticiasAccion: async () => ({ articles: [], evidence: observed }), obtenerFlujoOpciones: async () => [] },
  });
  const result = await run({ ...criteria, activeCores: ['001'] });
  const tipos = Object.fromEntries(result.excluded.map(row => [row.symbol, row.exclusionType]));
  assert.deepEqual(tipos, { VET: 'VIABILITY_VETO', SIN: 'NO_COLLAR', DAT: 'INSUFFICIENT_DATA' });
  assert.ok(result.excluded.every(row => row.reason));
  assert.deepEqual(result.candidates.map(row => row.symbol), ['BUE']);
  assert.equal('exclusionType' in result.candidates[0], false);
});

test('sin fecha de earnings la empresa conserva su posición con riesgo UNVERIFIED y el 003 se abstiene', async () => {
  let calendario = 'CAIDO';
  const run = createStrategyScreener({ universe: [{ symbol: 'AAA', companyName: 'AAA' }], now: () => asOf + (calendario === 'CAIDO' ? 0 : 100_000),
    edgar: { issuerIndex: async () => new Map(), holdingsReport: async () => ({ evidence: observed }), reportedHoldings: () => ({}),
      statements: async () => financial('VIABLE') },
    marketData: { obtenerSesionBursatil: async () => ({}), obtenerPrecioSubyacente: async () => stock,
      obtenerHistorialVelas: async () => history(),
      obtenerFechaResultados: async () => {
        if (calendario === 'CAIDO') throw new SourceError('Webull OpenAPI · Financial Alerts', 'Webull no entregó una fecha de resultados utilizable.');
        return earnings;
      },
      obtenerCadenaOpciones: async () => chain(), obtenerNoticiasAccion: async () => ({ articles: [], evidence: observed }),
      obtenerFlujoOpciones: async () => [{ contract: chain().contracts[0], trades: [{ price: 2, size: 2, side: null }], evidence: observed }] },
  });
  let result = await run(criteria);
  assert.equal(result.status, 'PARTIAL');
  const [fila] = result.candidates;
  assert.equal(fila?.symbol, 'AAA');
  assert.equal(fila.partial, true);
  assert.equal(fila.cores['002'].result.risk, 'UNVERIFIED');
  assert.match(fila.cores['002'].result.event.reason, /fecha de resultados utilizable/);
  assert.equal(fila.cores['002'].result.event.start, null);
  assert.equal(fila.cores['002'].status, 'PARTIAL');
  assert.ok(Number.isFinite(fila.cores['002'].score));
  assert.deepEqual([fila.cores['003'].result.signal, fila.cores['003'].result.rule, fila.cores['003'].status], ['HOLD', 'EVENT_UNVERIFIED', 'PARTIAL']);
  assert.equal(JSON.stringify(fila).includes('Financial Alerts ('), false);
  assert.equal(Object.values(fila.cores).flatMap(core => core.evidence).some(e => /Financial Alerts/.test(e.source)), false);

  calendario = 'CON_FECHA';
  result = await run(criteria);
  assert.equal(result.candidates[0].cores['002'].result.risk, 'LOW');
  assert.equal(result.candidates[0].cores['002'].result.event.start, '2027-01-20');
});

test('el calendario de resultados no inventa fechas cuando Webull no entrega una', async prueba => {
  const original = { ...config };
  Object.assign(config, { WEBULL_APP_KEY: 'app', WEBULL_APP_SECRET: 'secreto' });
  prueba.after(() => Object.assign(config, original));
  const { obtenerFechaResultados } = await import('../src/api/v2/services/strategyScreener/marketData.js');
  let respuesta = {};
  prueba.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => respuesta }));
  await assert.rejects(obtenerFechaResultados('AAPL', asOf), error => error instanceof SourceError && /fecha de resultados/.test(error.reason));
  respuesta = { start_date: '2027-01-20', end_date: '2027-01-21' };
  const fecha = await obtenerFechaResultados('AAPL', asOf);
  assert.equal(fecha.start, '2027-01-20');
  assert.doesNotMatch(fecha.evidence.source, /Estimado/);
});
