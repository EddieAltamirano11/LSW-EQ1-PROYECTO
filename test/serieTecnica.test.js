import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import config from '../src/config/config.js';
import { authMiddleware } from '../src/middlewares/auth.middleware.js';
import { errorHandler } from '../src/middlewares/errorHandler.middleware.js';
import { strategyScreenerRoutes } from '../src/api/v2/routes/strategyScreener.routes.js';
import { createTechnicalSeries, parseTechnicalSymbol } from '../src/api/v2/services/strategyScreener.service.js';
import { technicalCore } from '../src/api/v2/services/strategyScreener/technicalCore.js';
import { observation, SourceError } from '../src/api/v2/services/strategyScreener/observations.js';
import { historial, serieQueConverge, sesionesDespues } from './helpers/seriesTecnicas.js';

const asOf = Date.parse('2026-11-14T15:00:00Z');
const calendario = sesionesDespues('2026-11-13', 90);
const observado = observation('Alpaca Market Data IEX', '2026-11-13T21:00:00Z', 'AAPL · 1Day · 500 velas cerradas');
const sesion = { asOf, cutoff: asOf - 15 * 60_000, lastClosed: { date: '2026-11-13' }, upcoming: calendario };
const diarias = serieQueConverge();

async function servidor(t, marketData, reloj = () => asOf) {
  const app = express();
  app.use(express.json(), authMiddleware);
  app.use('/api/v2/strategy-screener', strategyScreenerRoutes(undefined, createTechnicalSeries({ marketData, now: reloj })));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/v2/strategy-screener/technical/`;
  const token = jwt.sign({ user: 'Pruebas de serie técnica' }, config.JWT_SECRET, { expiresIn: '5m' });
  return (simbolo, auth = token) => fetch(base + encodeURIComponent(simbolo), {
    headers: auth ? { Authorization: `Bearer ${auth}` } : {},
  });
}

test('la serie técnica entrega velas, medias, niveles con banda, tramos y proyección del Core 001', async t => {
  let consultas = 0;
  const consultar = await servidor(t, {
    obtenerSesionBursatil: async () => sesion,
    obtenerHistorialVelas: async simbolo => {
      consultas++;
      assert.equal(simbolo, 'AAPL');
      return { ...historial(diarias, calendario), evidence: [observado] };
    },
  });
  const respuesta = await consultar('aapl');
  assert.equal(respuesta.status, 200);
  const serie = await respuesta.json();
  const core = technicalCore(historial(diarias, calendario)).result;

  assert.equal(serie.symbol, 'AAPL');
  assert.equal(serie.source, 'Alpaca Market Data IEX');
  assert.equal(serie.lastSession, '2026-11-13');
  assert.equal(serie.cutoff, new Date(sesion.cutoff).toISOString());
  assert.equal(serie.candles.length, 500);
  assert.deepEqual(Object.keys(serie.candles[0]).sort(), ['close', 'high', 'low', 'open', 'time', 'volume']);
  assert.match(serie.candles[0].time, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(serie.candles.at(-1).time, '2026-11-13');

  assert.equal(serie.movingAverages.sma200.length, 301);
  assert.equal(serie.movingAverages.sma200[0].time, serie.candles[199].time);
  assert.equal(serie.movingAverages.ema50.length, 451);
  assert.equal(serie.movingAverages.ema20.length, 481);
  assert.ok(serie.movingAverages.ema20.every(punto => Number.isFinite(punto.value)));

  assert.deepEqual(serie.support.map(nivel => nivel.price), core.support.map(nivel => nivel.price));
  assert.deepEqual(serie.resistance.map(nivel => nivel.price), core.resistance.map(nivel => nivel.price));
  for (const nivel of [...serie.support, ...serie.resistance]) assert.ok(nivel.lower < nivel.price && nivel.price < nivel.upper);
  assert.deepEqual(serie.segments, core.segments);
  assert.deepEqual(serie.scales, core.scales);
  assert.deepEqual(serie.projections, core.projections);
  assert.equal(serie.projections.short.projected, true);
  assert.deepEqual(serie.upcoming, calendario.slice(0, 60));
  assert.deepEqual(serie.evidence, [observado]);

  assert.equal((await consultar('AAPL')).status, 200);
  assert.equal(consultas, 1, 'la segunda consulta dentro de 90 s sale de la caché');
});

test('la serie técnica exige sesión y rechaza símbolos inválidos sin consultar la fuente', async t => {
  let consultas = 0;
  const consultar = await servidor(t, {
    obtenerSesionBursatil: async () => { consultas++; return sesion; },
    obtenerHistorialVelas: async () => { consultas++; return historial(diarias, calendario); },
  });
  assert.equal((await consultar('AAPL', '')).status, 401);
  for (const invalido of ['AA PL', 'A@PL', 'DEMASIADOLARGO', '1']) {
    const respuesta = await consultar(invalido);
    assert.equal(respuesta.status, 400, invalido);
    assert.match((await respuesta.json()).message, /símbolo/i);
  }
  assert.equal(consultas, 0);
  assert.equal(parseTechnicalSymbol(' brk.b '), 'BRK.B');
});

test('la serie técnica responde 503 con la causa cuando la fuente no entrega velas y no guarda el fallo', async t => {
  let falla = true;
  let reloj = asOf;
  const consultar = await servidor(t, {
    obtenerSesionBursatil: async () => sesion,
    obtenerHistorialVelas: async () => {
      if (falla) throw new SourceError('Alpaca Market Data IEX', 'Serie 1Day incompleta o fuera de vigencia para AAPL.');
      return historial(diarias, calendario);
    },
  }, () => reloj);
  let respuesta = await consultar('AAPL');
  assert.equal(respuesta.status, 503);
  assert.match((await respuesta.json()).message, /Serie 1Day incompleta/);
  falla = false;
  reloj += 1000;
  respuesta = await consultar('AAPL');
  assert.equal(respuesta.status, 200);
});

test('la serie técnica responde 503 cuando el Core 001 no tiene velas suficientes', async t => {
  const consultar = await servidor(t, {
    obtenerSesionBursatil: async () => sesion,
    obtenerHistorialVelas: async () => historial(diarias.slice(-40), calendario),
  });
  const respuesta = await consultar('MSFT');
  assert.equal(respuesta.status, 503);
  assert.match((await respuesta.json()).message, /Faltan velas/);
});
