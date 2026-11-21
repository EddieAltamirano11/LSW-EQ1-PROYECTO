import assert from 'node:assert/strict';
import { test } from 'node:test';
import axios from 'axios';
import config from '../src/config/config.js';
import {
  elegirCollar, obtenerCadenaCobertura, obtenerCadenaOpciones, obtenerPrecioSubyacente, obtenerSesionBursatil,
} from '../src/api/v1/services/cadenaOpciones.service.js';
import * as marketData from '../src/api/v2/services/strategyScreener/marketData.js';
import { strategyCore } from '../src/api/v2/services/strategyScreener/optionsCores.js';
import { getBrokerOptionsChain } from '../src/api/v1/services/broker.service.js';
import { autoCalibrateAndCreateCollar, recommendOption } from '../src/api/v1/services/hedging.service.js';

// Dobles de prueba sin red: fetch responde por URL con la forma de Alpaca (calendario, velas y contratos)
// y de Webull (snapshots de opciones). Son datos de prueba, no cotizaciones reales.

const ahora = Date.parse('2026-11-20T19:00:00Z'); // 14:00 en Nueva York, sesión abierta
const cotizado = Date.parse('2026-11-20T18:40:00Z');
const contrato = (tipo, strike) => ({
  symbol: `AAPL270108${tipo === 'put' ? 'P' : 'C'}${String(strike * 1000).padStart(8, '0')}`,
  underlying_symbol: 'AAPL', type: tipo, expiration_date: '2027-01-08', strike_price: String(strike), multiplier: '100',
  tradable: true, deliverables: [{ type: 'equity', symbol: 'AAPL', amount: '100' }],
});
const listados = [325, 330, 335].map(k => contrato('put', k)).concat([355, 360, 365].map(k => contrato('call', k)));
const cotizacion = (c, cambios = {}) => ({
  symbol: c.symbol, bid: c.type === 'put' ? '5.80' : '5.00', ask: c.type === 'put' ? '6.00' : '5.20',
  volume: '120', open_interest: '900', gamma: '0.01', quote_time: String(cotizado), delay_minutes: '0', ...cambios,
});

let noListadosEnWebull = new Set();

function simularMercado(prueba, { snapshots = () => listados.map(c => cotizacion(c)), contratos = () => listados } = {}) {
  const original = { ...config };
  Object.assign(config, {
    ALPACA_API_KEY_ID: 'clave', ALPACA_API_SECRET_KEY: 'secreto', WEBULL_APP_KEY: 'app', WEBULL_APP_SECRET: 'secreto',
  });
  prueba.after(() => Object.assign(config, original));
  const llamadas = [];
  prueba.mock.method(globalThis, 'fetch', async url => {
    const destino = new URL(url);
    llamadas.push(destino.pathname);
    const responder = cuerpo => ({ ok: true, status: 200, json: async () => cuerpo });
    if (destino.pathname === '/v2/calendar') {
      return responder([{ date: '2026-11-19', open: '09:30', close: '16:00' }, { date: '2026-11-20', open: '09:30', close: '16:00' }]);
    }
    if (destino.pathname === '/v2/stocks/AAPL/bars') {
      return responder({ bars: [{ t: '2026-11-20T18:40:00Z', o: 343, h: 343.6, l: 342.9, c: 343.4, v: 900 }], next_page_token: null });
    }
    if (destino.pathname === '/v2/options/contracts') return responder({ option_contracts: contratos(), next_page_token: null });
    if (destino.pathname === '/market-data/options/snapshots/list') {
      const pedidos = destino.searchParams.get('symbols').split(',');
      // Webull rechaza el lote completo (417 INVALID_SYMBOL) si contiene un símbolo que no está en su catálogo.
      const desconocidos = pedidos.filter(s => noListadosEnWebull.has(s));
      if (desconocidos.length) {
        const cuerpo = JSON.stringify({ error_code: 'INVALID_SYMBOL', message: `Invalid Symbol:[${desconocidos.join(', ')}]` });
        return { ok: false, status: 417, json: async () => JSON.parse(cuerpo), text: async () => cuerpo };
      }
      const datos = snapshots();
      return datos instanceof Error ? { ok: false, status: 503, json: async () => ({}), text: async () => '' } : responder(datos.filter(d => pedidos.includes(d.symbol)));
    }
    throw new Error(`URL inesperada ${url}`);
  });
  return llamadas;
}

async function cadenaDelScreener() {
  const sesion = await obtenerSesionBursatil(ahora);
  const spot = await obtenerPrecioSubyacente('AAPL', sesion);
  return { sesion, spot, cadena: await obtenerCadenaOpciones('AAPL', spot, 45, sesion) };
}

test('la cadena compartida entrega contratos listados con cotización, instante y retraso, y descarta retrasos mayores a 15 minutos', async prueba => {
  simularMercado(prueba, {
    snapshots: () => listados.map(c => cotizacion(c, c.symbol.includes('P00330000') ? { delay_minutes: '20' } : {})),
  });
  const { cadena } = await cadenaDelScreener();
  const simbolos = cadena.contracts.map(c => c.symbol);
  assert.ok(simbolos.length > 0);
  assert.ok(simbolos.every(s => listados.some(c => c.symbol === s)));
  assert.equal(simbolos.some(s => s.includes('P00330000')), false);
  for (const c of cadena.contracts) {
    assert.ok(c.bid > 0 && c.ask > 0 && c.at === cotizado && c.delay === 0 && c.multiplier === 100);
  }
  assert.equal(marketData.obtenerCadenaOpciones, obtenerCadenaOpciones, 'el screener delega en el servicio compartido');
});

test('la cobertura responde 503 cuando no hay contratos cotizados o el proveedor no responde', async prueba => {
  let snapshots = () => [];
  simularMercado(prueba, { snapshots: () => snapshots() });
  await assert.rejects(obtenerCadenaCobertura('AAPL', { ahora }), error => error.output?.statusCode === 503);
  snapshots = () => new Error('caído');
  await assert.rejects(obtenerCadenaCobertura('AAPL', { ahora }), error => error.output?.statusCode === 503);
});

test('GET options-chain entrega la misma cadena real en los tres brokers, sin contratos ajenos a la lista', async prueba => {
  simularMercado(prueba);
  for (const broker of ['ALPACA', 'WEBULL', 'IBKR']) {
    const cadena = await getBrokerOptionsChain('AAPL', undefined, broker, { ahora });
    const todos = [...cadena.puts, ...cadena.calls];
    assert.ok(todos.length > 0, broker);
    for (const c of todos) {
      assert.ok(listados.some(l => l.symbol === c.contractSymbol), `${broker} ${c.contractSymbol}`);
      assert.ok(c.ask > 0 && c.bid > 0);
      assert.equal(c.quoteTime, new Date(cotizado).toISOString());
      assert.equal(typeof c.delayMinutes, 'number');
      assert.match(c.source, /Webull/);
    }
    assert.equal(cadena.spotPrice, 343.4);
  }
});

test('la vista previa del Auto-Collar es el collar del Core 004 y no emite órdenes ni guarda', async prueba => {
  simularMercado(prueba);
  const emitir = prueba.mock.method(axios, 'post', async () => { throw new Error('no debe emitir'); });
  const vista = await autoCalibrateAndCreateCollar({ symbol: 'AAPL', executeOrders: false, broker: 'ALPACA', ahora }, 'supabase');
  const { cadena, spot } = await cadenaDelScreener();
  const core = strategyCore(spot, cadena).result;
  assert.equal(vista.preview.put.contractSymbol, core.put.symbol);
  assert.equal(vista.preview.call.contractSymbol, core.call.symbol);
  assert.equal(vista.preview.put.ask, core.put.ask);
  assert.equal(vista.preview.call.bid, core.call.bid);
  assert.deepEqual([vista.preview.metrics.maxLoss, vista.preview.metrics.maxProfit, vista.preview.metrics.breakEven],
    [core.maxLoss, core.maxProfit, core.breakEven]);
  assert.equal(vista.strategy, null);
  assert.equal(vista.brokerExecution.executed, false);
  assert.equal(emitir.mock.callCount(), 0);
  assert.deepEqual(elegirCollar(spot, cadena)?.put.symbol, core.put.symbol);
});

test('la recomendación de Put devuelve un contrato listado con su ask, instante y fuente', async prueba => {
  simularMercado(prueba);
  const respuesta = await recommendOption({ symbol: 'AAPL', type: 'PUT', broker: 'WEBULL', ahora });
  const put = respuesta.recommendedContract;
  assert.ok(listados.some(c => c.symbol === put.contractSymbol && c.type === 'put'));
  assert.equal(put.ask, 6);
  assert.equal(put.quoteTime, new Date(cotizado).toISOString());
  assert.match(put.source, /Webull/);
  assert.ok(put.strike < 343.4);
});

test('la cadena excluye los contratos que Webull no cotiza en lugar de perder todo el lote', async prueba => {
  noListadosEnWebull = new Set([listados[1].symbol, listados[4].symbol]);
  prueba.after(() => { noListadosEnWebull = new Set(); });
  simularMercado(prueba);
  const { cadena } = await cadenaDelScreener();
  const simbolos = cadena.contracts.map(c => c.symbol);
  assert.ok(simbolos.length >= 2);
  assert.equal(simbolos.includes(listados[1].symbol), false);
  assert.equal(simbolos.includes(listados[4].symbol), false);
});
