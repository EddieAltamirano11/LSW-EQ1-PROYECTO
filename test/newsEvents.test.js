import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularCoreNoticias } from '../src/api/v2/services/strategyScreener/confluenceCores.js';
import { companySubmissions, filingsNews } from '../src/api/v2/services/strategyScreener/edgar.js';
import { eventosEjecutivosDel8K, liderazgo } from '../src/api/v2/services/strategyScreener/newsEvents.js';
import { anexarReaccionMercado } from '../src/api/v2/services/strategyScreener/newsReaction.js';

const corte = Date.parse('2026-11-26T02:55:22Z');
const activo = { symbol: 'NVDA', companyName: 'NVIDIA Corporation' };
const noticia = (id, headline, created_at = '2026-11-23T14:31:20Z', url) => ({
  id, headline, created_at, url, source: 'Proveedor de prueba', symbols: [activo.symbol],
});
const oficial = (id, accion, fecha) => ({
  ...noticia(id, liderazgo[accion].label, fecha), source: 'SEC EDGAR · 8-K', timeSource: 'SEC_ACCEPTANCE',
  event: { ...liderazgo[accion], state: 'CONFIRMED' },
});

test('006 vincula noticias a su 8-K y conserva hechos distintos con la misma URL bursátil', () => {
  const ficha = 'https://example.com/stock/NVDA-US?source=feed';
  const articles = [
    noticia(1, 'NVIDIA Reinstates Executive as President and CEO'),
    noticia(2, 'NVIDIA CEO Agrees to Senate Testimony', '2026-11-23T12:32:04Z', ficha),
    noticia(3, 'Daiwa Adjusts Price Target on NVIDIA to $185 From $245', '2026-11-19T13:02:23Z', ficha),
    noticia(4, 'California Attorney General Launches Investigation into NVIDIA', '2026-11-20T19:01:43Z'),
    noticia(5, 'NVIDIA Announces CEO Resignation and Leadership Transition', '2026-11-12T14:32:03Z'),
    noticia(6, 'Lawmakers Push for Reinstatement of NVIDIA CEO'),
    noticia(7, 'Democrats Open Probe into NVIDIA Influence on Megaspeed Investigation'),
    noticia(8, 'NVIDIA CEO Steps Down', '2026-11-27T00:00:00Z'),
  ];
  const reportes = { value: { articles: [
    oficial('return', 'REINSTATEMENT', '2026-11-23T13:57:54Z'),
    oficial('departure', 'DEPARTURE', '2026-11-12T13:52:41Z'),
  ] } };
  const { result } = calcularCoreNoticias({ articles }, corte, activo, reportes);
  const events = new Map(result.events.map(evento => [evento.id, evento]));
  assert.equal(result.observed, 6);
  assert.equal(result.contextObserved, 7);
  assert.equal(events.get('return').publishedAt, '2026-11-23T13:57:54Z');
  assert.deepEqual(events.get('return').related.map(articulo => articulo.id), [1]);
  assert.equal(events.has(1), false);
  assert.equal(events.get('departure').contextOnly, true);
  assert.equal(events.get('departure').impact, 0);
  assert.equal(events.get(2).event.action, 'HEARING');
  assert.ok(events.get(3).impact < 0);
  assert.equal(events.get(4).event.state, 'OPEN');
  assert.equal(events.get(6)?.event, undefined);
  assert.equal(events.get(7)?.event, undefined);
  assert.equal(events.has(8), false);
});

test('006 conserva el puntaje reciente cuando el contexto de noticias falla', () => {
  const { status, score, reason } = calcularCoreNoticias(
    { articles: [noticia(1, 'NVIDIA cuts guidance')], contextReason: 'Contexto indisponible' }, corte, activo,
  );
  assert.equal(status, 'PARTIAL');
  assert.ok(score < 66);
  assert.equal(reason, 'Contexto indisponible');
});

test('006 lee el ítem 5.02 del 8-K y distingue los cambios de CEO de otros cargos', () => {
  const html = '<div>Item 5.02. Departure of Officers</div>'
    + '<div>The Board accepted the resignation of Jane Doe, as Example&#8217;s President and Chief Executive Officer.</div>'
    + '<div>The Board appointed Alex D. Jones to serve as interim Chief Executive Officer.</div>'
    + '<div>Item 9.01. The Board reinstated Jane Doe as CEO.</div>';
  assert.deepEqual(eventosEjecutivosDel8K(html).map(evento => evento.action), ['DEPARTURE', 'INTERIM']);
  assert.deepEqual(eventosEjecutivosDel8K('<p>Item 5.02. Jane Doe resigned as Chief Financial Officer.</p>'), []);
});

test('006 consulta 8-K visibles al corte y usa el sello de aceptación de EDGAR', async t => {
  const anterior = process.env.SEC_EDGAR_USER_AGENT;
  process.env.SEC_EDGAR_USER_AGENT = 'Prueba de unidad test@example.com';
  t.after(() => {
    if (anterior === undefined) delete process.env.SEC_EDGAR_USER_AGENT;
    else process.env.SEC_EDGAR_USER_AGENT = anterior;
  });
  const forms = {
    form: ['8-K', '8-K', '8-K'],
    items: ['5.02,9.01', '2.02,9.01', '5.02'],
    accessionNumber: ['0001045810-26-000001', '0001045810-26-000002', '0001045810-26-000003'],
    acceptanceDateTime: ['2026-11-23T13:57:54Z', '2026-11-17T21:20:51Z', '2026-11-27T15:00:00Z'],
    primaryDocument: ['first.htm', 'results.htm', 'future.htm'],
  };
  const fetch = t.mock.method(globalThis, 'fetch', async url => new Response(
    url.hostname === 'data.sec.gov' ? JSON.stringify({ cik: 1045810, filings: { recent: forms } })
      : '<p>Item 5.02. The Board reinstated Jane Doe as Chief Executive Officer.</p>',
  ));
  const documentos = await companySubmissions('NVDA', new Map([['NVDA', '0001045810']]));
  const recuperados = await filingsNews('NVDA', documentos, corte);
  assert.deepEqual(recuperados.articles.map(({ event, created_at }) => [event.action, created_at]), [
    ['REINSTATEMENT', forms.acceptanceDateTime[0]], ['RESULTS', forms.acceptanceDateTime[1]],
  ]);
  assert.equal(fetch.mock.callCount(), 2);
});

test('la reacción asigna preapertura y poscierre a su sesión y evita métricas futuras', () => {
  const fechas = ['2026-11-20', '2026-11-23', '2026-11-24'];
  const sessions = fechas.map(date => ({ date, open: Date.parse(date + 'T14:30:00Z'), close: Date.parse(date + 'T21:00:00Z') }));
  const mercado = { sessions, cutoff: Date.parse('2026-11-24T19:00:00Z') };
  const vela = (date, open, close, volume = 10) => ({ at: Date.parse(date + 'T05:00:00Z'), open, close, volume });
  const previas = Array.from({ length: 19 }, (_, i) => vela('2026-11-' + String(i + 1).padStart(2, '0'), 100, 100));
  const velas = [...previas, vela(fechas[0], 100, 100), vela(fechas[1], 132, 131, 25), vela(fechas[2], 125, 124)];
  const smh = [vela(fechas[0], 100, 100), vela(fechas[1], 110, 115)];
  const fechasNoticias = ['2026-11-20T21:00:00Z', '2026-11-23T13:57:54Z', '2026-11-23T14:31:00Z', '2026-11-23T22:00:00Z'];
  const reacciones = anexarReaccionMercado(fechasNoticias.map(publishedAt => ({ publishedAt })), mercado, velas, 'SMH', smh)
    .map(evento => evento.reaction);
  assert.deepEqual(reacciones[0], reacciones[1]);
  assert.equal(reacciones[1].session, fechas[1]);
  assert.equal(reacciones[1].openingGap, 32);
  assert.equal(reacciones[1].sessionChange, 31);
  assert.equal(reacciones[1].relativeVolume, 2.5);
  assert.deepEqual(reacciones[1].benchmark, { symbol: 'SMH', sessionChange: 15, excess: 16 });
  assert.equal(reacciones[2].openingGap, null);
  assert.deepEqual(reacciones[3], { status: 'PENDING', session: fechas[2] });
});
