import assert from 'node:assert/strict';
import test from 'node:test';
import { technicalCore } from '../src/api/v2/services/strategyScreener/technicalCore.js';
import { claseAdx, precisionHistorica, proyectarCruce, zonaRsi } from '../src/api/v2/services/strategyScreener/historialTecnico.js';
import {
  historial, serieConEscalon, serieConSoportes, serieQueConverge, serieQueSeSepara, sesionesDespues, sesionesHasta, velas,
} from './helpers/seriesTecnicas.js';

const calendario = sesionesDespues('2026-11-13', 90);

test('001 confirma la tendencia intermedia en la fecha del cruce y arma tramos con fechas', () => {
  const { scales, segments } = technicalCore(historial(serieConEscalon('2026-08-14'), calendario)).result;
  assert.equal(scales.intermediate.direction, 'UP');
  assert.equal(scales.intermediate.since, '2026-08-14');
  const vigente = segments.intermediate.at(-1);
  assert.deepEqual([vigente.direction, vigente.start, vigente.end], ['UP', '2026-08-14', '2026-11-13']);
  assert.ok(segments.intermediate.at(-2).end < '2026-08-14');
});

test('001 elige los soportes por puntaje y no solo por cercanía', () => {
  const { support } = technicalCore(historial(serieConSoportes(), calendario)).result;
  assert.equal(support[0].price, 90);
  assert.equal(support[0].touches, 4);
  const cercano = support.find(nivel => nivel.price === 97);
  assert.ok(cercano && cercano.touches === 1 && support[0].score > cercano.score);
  for (const nivel of support) assert.ok(nivel.lastTouch && Number.isFinite(nivel.distancePct));
});

test('001 informa como no disponibles las escalas sin velas suficientes para la SMA200', () => {
  const diarias = velas(sesionesHasta('2026-11-13', 150), i => 100 + i * 0.2);
  const { scales } = technicalCore(historial(diarias, calendario)).result;
  for (const escala of ['primary', 'intermediate']) {
    assert.equal(scales[escala].available, false);
    assert.match(scales[escala].reason, /SMA200/);
  }
  assert.equal(scales.short.available, true);
});

test('001 proyecta una ventana de fechas, no un día exacto, cuando las medias convergen', () => {
  const corta = technicalCore(historial(serieQueConverge(), calendario)).result.projections.short;
  assert.equal(corta.projected, true);
  assert.equal(corta.direction, 'DOWN');
  assert.ok(calendario.includes(corta.window.from) && calendario.includes(corta.window.to));
  assert.ok(corta.window.from <= corta.window.to);
  assert.ok(corta.sessions.from >= 1 && corta.sessions.to <= 60);
  assert.match(corta.assumption, /pendiente/);
  assert.ok(Number.isInteger(corta.accuracy.cases) && 'hitRate' in corta.accuracy);
});

test('001 indica que no hay cambio proyectado cuando las medias se separan', () => {
  const corta = technicalCore(historial(serieQueSeSepara(), calendario)).result.projections.short;
  assert.equal(corta.projected, false);
  assert.match(corta.reason, /separan/);
});

test('la proyección respeta el horizonte de 60 sesiones', () => {
  const lenta = Array.from({ length: 20 }, (_, x) => 10 - 0.1 * x);
  assert.deepEqual(proyectarCruce(lenta, 19), { converge: true, dentroDelHorizonte: false });
  const rapida = proyectarCruce(Array.from({ length: 20 }, (_, x) => 3 - 0.1 * x), 19);
  assert.equal(rapida.dentroDelHorizonte, true);
  assert.ok(rapida.desde <= 11 && 11 <= rapida.hasta);
});

test('la precisión medida cuenta los cruces precedidos de una proyección y advierte muestras pequeñas', () => {
  const triangular = Array.from({ length: 400 }, (_, x) => 10.25 - Math.abs((x % 80) - 40) * 0.5);
  const amplia = precisionHistorica(triangular);
  assert.ok(amplia.cases >= 3);
  assert.ok(amplia.hitRate >= 0 && amplia.hitRate <= 1);
  assert.equal(amplia.insufficientSample, false);
  const escasa = precisionHistorica(Array.from({ length: 60 }, (_, x) => 10.25 - 0.5 * x));
  assert.equal(escasa.cases, 1);
  assert.equal(escasa.hitRate, 1);
  assert.equal(escasa.insufficientSample, true);
});

test('001 lee los indicadores con los parámetros de la guía', () => {
  assert.equal(zonaRsi(74), 'OVERBOUGHT');
  assert.equal(zonaRsi(50), 'NEUTRAL');
  assert.equal(zonaRsi(25), 'OVERSOLD');
  assert.equal(claseAdx(15), 'NO_TREND');
  assert.equal(claseAdx(22), 'WEAK');
  assert.equal(claseAdx(31), 'STRONG');
  assert.equal(claseAdx(55), 'VERY_STRONG');
  const { indicators } = technicalCore(historial(serieQueSeSepara(), calendario)).result;
  assert.equal(indicators.rsi.zone, zonaRsi(indicators.rsi.value));
  assert.equal(indicators.adx.class, claseAdx(indicators.adx.value));
  for (const campo of ['plusDI', 'minusDI']) assert.ok(Number.isFinite(indicators.adx[campo]));
  for (const campo of ['line', 'signal', 'histogram']) assert.ok(Number.isFinite(indicators.macd[campo]));
  for (const campo of ['upper', 'middle', 'lower', 'width']) assert.ok(Number.isFinite(indicators.bollinger[campo]));
});

test('el puntaje, la dirección y la confianza del 001 no dependen de la proyección', () => {
  const diarias = serieQueConverge();
  const base = technicalCore(historial(diarias, calendario));
  const otroCalendario = technicalCore(historial(diarias, sesionesDespues('2026-12-31', 90)));
  const sinCalendario = technicalCore(historial(diarias));
  assert.notDeepEqual(otroCalendario.result.projections.short.window, base.result.projections.short.window);
  for (const otro of [otroCalendario, sinCalendario]) {
    assert.deepEqual([otro.score, otro.direction, otro.confidence], [base.score, base.direction, base.confidence]);
  }
});
