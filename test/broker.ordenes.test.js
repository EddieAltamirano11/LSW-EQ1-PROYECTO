import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { test } from 'node:test';
import axios from 'axios';
import config from '../src/config/config.js';
import { alpacaDataClient } from '../src/config/broker.config.js';
import {
  cancelBrokerOrder, createBrokerOrder, getBrokerAccount, getBrokerOrders, getBrokerPositions, getBrokerQuote,
} from '../src/api/v1/services/broker.service.js';

// Dobles de prueba sin red: axios para Alpaca y spawnSync para los puentes de Webull e IBKR.
// Las posiciones de Webull siguen la forma de la muestra real del 2026-11-20 (docs/evidencias-pruebas-api).

const tieneEstado = estado => error => error.output?.statusCode === estado;

function configurarAlpaca(prueba) {
  const original = { ...config };
  Object.assign(config, { ALPACA_BASE_URL: 'https://paper-api.alpaca.markets', ALPACA_API_KEY_ID: 'clave', ALPACA_API_SECRET_KEY: 'secreto' });
  prueba.after(() => Object.assign(config, original));
}

function simularAlpaca(prueba, { cuenta, posiciones = [], snapshot, enviar, cancelar, ordenes = [] } = {}) {
  configurarAlpaca(prueba);
  const leer = prueba.mock.method(axios, 'get', async url => {
    if (url.endsWith('/v2/account')) return typeof cuenta === 'function' ? cuenta() : { data: cuenta };
    if (url.endsWith('/v2/positions')) return typeof posiciones === 'function' ? posiciones() : { data: posiciones };
    if (url.includes('/v2/orders')) return typeof ordenes === 'function' ? ordenes() : { data: ordenes };
    throw new Error(`URL inesperada ${url}`);
  });
  const cotizar = prueba.mock.method(alpacaDataClient, 'get', async () => (typeof snapshot === 'function' ? snapshot() : { data: snapshot }));
  const emitir = prueba.mock.method(axios, 'post', async (_url, cuerpo) => enviar(cuerpo));
  const borrar = prueba.mock.method(axios, 'delete', async () => cancelar());
  return { leer, cotizar, emitir, borrar };
}

function simularPuente(prueba, responder) {
  const llamadas = [];
  const simulacion = prueba.mock.method(childProcess, 'spawnSync', (_ejecutable, argumentos) => {
    const [, comando, ...resto] = argumentos;
    llamadas.push({ comando, argumentos: resto });
    const respuesta = responder(comando, resto);
    return respuesta === undefined ? { stdout: '', error: new Error('sin respuesta') } : { stdout: JSON.stringify(respuesta) };
  });
  syncBuiltinESMExports();
  prueba.after(() => {
    simulacion.mock.restore();
    syncBuiltinESMExports();
  });
  return llamadas;
}

const cuentaAlpaca = { id: 'cuenta', status: 'ACTIVE', currency: 'USD', cash: '1000', portfolio_value: '1000', buying_power: '1000' };
const compraAcciones = { symbol: 'AAPL', instrumentType: 'EQUITY', side: 'buy', type: 'limit', qty: 2, limitPrice: 100 };

test('una orden incompleta se rechaza con 400 antes de contactar al broker', async prueba => {
  const dobles = simularAlpaca(prueba, { cuenta: cuentaAlpaca, enviar: () => ({ data: { id: 'x' } }) });
  const incompletas = [
    [{ ...compraAcciones, limitPrice: undefined }, /limitPrice/],
    [{ ...compraAcciones, side: undefined }, /side/],
    [{ ...compraAcciones, type: undefined }, /type/],
    [{ ...compraAcciones, qty: 0 }, /qty/],
    [{ ...compraAcciones, qty: 1.5 }, /qty/],
    [{ ...compraAcciones, qty: undefined }, /qty/],
    [{ ...compraAcciones, instrumentType: undefined }, /instrumentType/],
    [{ symbol: 'AAPL', instrumentType: 'OPTION', side: 'buy', type: 'limit', qty: 1, limitPrice: 2, optionType: 'PUT', strikePrice: 300 }, /vencimiento|expirationDate/],
    [{ symbol: 'AAPL', instrumentType: 'OPTION', side: 'buy', type: 'limit', qty: 1, limitPrice: 2, optionType: 'PUT', expirationDate: '2026-12-18' }, /strike/],
    [{ symbol: 'AAPL', instrumentType: 'OPTION', side: 'buy', type: 'limit', qty: 1, limitPrice: 2, strikePrice: 300, expirationDate: '2026-12-18' }, /optionType/],
  ];
  for (const [orden, campo] of incompletas) {
    await assert.rejects(createBrokerOrder(orden, 'ALPACA'), error => tieneEstado(400)(error) && campo.test(error.message), JSON.stringify(orden));
  }
  assert.equal(dobles.leer.mock.callCount(), 0);
  assert.equal(dobles.cotizar.mock.callCount(), 0);
  assert.equal(dobles.emitir.mock.callCount(), 0);
});

test('una compra de mercado se envía sin precio límite y valida el Buying Power con el ask observado', async prueba => {
  let enviado;
  let snapshot = { latestTrade: { p: 99 }, latestQuote: { bp: 99.5, ap: 100, t: '2026-11-20T20:59:00Z' } };
  const dobles = simularAlpaca(prueba, {
    cuenta: cuentaAlpaca, snapshot: () => ({ data: snapshot }),
    enviar: cuerpo => { enviado = cuerpo; return { data: { id: 'ord-1', status: 'accepted', filled_qty: '0', symbol: 'AAPL', qty: '5', side: 'buy', type: 'market' } }; },
  });
  const mercado = { symbol: 'AAPL', instrumentType: 'EQUITY', side: 'buy', type: 'market', qty: 5 };
  const respuesta = await createBrokerOrder(mercado, 'ALPACA');
  assert.equal('limit_price' in enviado, false);
  assert.equal(enviado.type, 'market');
  assert.equal(respuesta.order.id, 'ord-1');

  await assert.rejects(createBrokerOrder({ ...mercado, qty: 11 }, 'ALPACA'),
    error => tieneEstado(400)(error) && /1,?100\.00/.test(error.message) && /1,?000\.00/.test(error.message));

  snapshot = { latestTrade: { p: 99 } };
  await assert.rejects(createBrokerOrder(mercado, 'ALPACA'), tieneEstado(503));
  assert.equal(dobles.emitir.mock.callCount(), 1);
});

test('sin cuenta legible no se emite la compra', async prueba => {
  const dobles = simularAlpaca(prueba, { cuenta: () => { throw new Error('timeout'); }, enviar: () => ({ data: { id: 'x' } }) });
  await assert.rejects(createBrokerOrder(compraAcciones, 'ALPACA'), tieneEstado(503));
  dobles.leer.mock.mockImplementation(async () => ({ data: { ...cuentaAlpaca, buying_power: null } }));
  await assert.rejects(createBrokerOrder(compraAcciones, 'ALPACA'), tieneEstado(503));
  assert.equal(dobles.emitir.mock.callCount(), 0);
});

// Muestra con la forma real de Webull: un COVERED_STOCK (100 acciones + 1 Call) y un PUT suelto de 5 contratos.
const posicionesWebull = [
  { position_id: 'p1', symbol: 'AAPL', option_strategy: 'COVERED_STOCK', instrument_type: 'OPTION', quantity: '1',
    cost_price: '345.10', last_price: '343.08', market_value: '34308.00', unrealized_profit_loss: '-202.00',
    legs: [
      { symbol: 'AAPL', instrument_type: 'EQUITY', last_price: '344.87' },
      { symbol: 'AAPL', instrument_type: 'OPTION', option_type: 'CALL', option_expire_date: '2026-12-18', option_exercise_price: '370', option_contract_deliverable: '100', last_price: '1.79' },
    ] },
  { position_id: 'p2', symbol: 'AAPL', option_strategy: 'SINGLE', instrument_type: 'OPTION', quantity: '5',
    cost_price: '0.11', last_price: '0.20', market_value: '97.50',
    legs: [{ symbol: 'AAPL', instrument_type: 'OPTION', option_type: 'PUT', option_expire_date: '2026-12-18', option_exercise_price: '215', option_contract_deliverable: '100', last_price: '0.195' }] },
];

test('la venta de acciones cuenta solo acciones y responde 503 si no puede leer posiciones', async prueba => {
  let posiciones = { success: true, positions: posicionesWebull };
  const llamadas = simularPuente(prueba, comando => {
    if (comando === 'positions') return posiciones;
    if (comando === 'place_order') return { success: true, result: { order_id: 'wb-1' } };
    return { success: false };
  });
  const venta = { symbol: 'AAPL', instrumentType: 'EQUITY', side: 'sell', type: 'limit', qty: 105, limitPrice: 340 };
  await assert.rejects(createBrokerOrder(venta, 'WEBULL'), error => tieneEstado(400)(error) && /100 acciones/.test(error.message));
  assert.equal(llamadas.some(llamada => llamada.comando === 'place_order'), false);

  const aceptada = await createBrokerOrder({ ...venta, qty: 100 }, 'WEBULL');
  assert.equal(aceptada.order.id, 'wb-1');

  const [posicion] = await getBrokerPositions('WEBULL');
  assert.equal(posicion.instrumentType, 'OPTION');
  assert.equal(posicion.optionStrategy, 'COVERED_STOCK');
  assert.equal(posicion.equityQty, 100);
  assert.equal(posicion.currentPrice, 343.08);
  assert.equal(posicion.marketValue, 34308);

  posiciones = undefined;
  await assert.rejects(createBrokerOrder({ ...venta, qty: 1 }, 'WEBULL'), tieneEstado(503));
  await assert.rejects(getBrokerPositions('WEBULL'), tieneEstado(503));
});

test('la emisión responde con el identificador y los datos del broker, sin inventar llenados', async prueba => {
  let respuesta = { success: true, result: { order_id: 'wb-2' } };
  const llamadas = simularPuente(prueba, comando => {
    if (comando === 'account') return { success: true, cash: 5000, portfolioValue: 5000, buyingPower: 5000, currency: 'USD' };
    if (comando === 'quote') return { success: true, price: 100, bid: 99.9, ask: 100.1 };
    if (comando === 'place_order' || comando === 'place_option') return respuesta;
    return { success: false };
  });
  const orden = await createBrokerOrder(compraAcciones, 'WEBULL');
  assert.equal(orden.order.id, 'wb-2');
  assert.equal(orden.order.filledQty, null);
  assert.equal(orden.order.status, null);
  assert.doesNotMatch(orden.message, /ejecutad|confirmad/i);
  const argumentos = llamadas.find(llamada => llamada.comando === 'place_order').argumentos;
  assert.deepEqual(argumentos.slice(argumentos.indexOf('--price'), argumentos.indexOf('--price') + 2), ['--price', '100']);

  await createBrokerOrder({ ...compraAcciones, type: 'market', limitPrice: undefined }, 'WEBULL');
  const mercado = llamadas.filter(llamada => llamada.comando === 'place_order').at(-1);
  assert.equal(mercado.argumentos.includes('--price'), false);
  assert.equal(mercado.argumentos[mercado.argumentos.indexOf('--type') + 1], 'MARKET');

  const opcion = { symbol: 'AAPL', instrumentType: 'OPTION', side: 'buy', type: 'limit', qty: 1, limitPrice: 2, contractSymbol: 'AAPL261218P00300000' };
  respuesta = { success: true, result: { order_id: 'wb-3' } };
  await createBrokerOrder(opcion, 'WEBULL');
  const argumentosOpcion = llamadas.filter(llamada => llamada.comando === 'place_option').at(-1).argumentos;
  const valor = clave => argumentosOpcion[argumentosOpcion.indexOf(clave) + 1];
  assert.deepEqual([valor('--option_type'), valor('--strike_price'), valor('--expire_date')], ['PUT', '300', '2026-12-18']);

  respuesta = { success: true, result: {} };
  await assert.rejects(createBrokerOrder(compraAcciones, 'WEBULL'), tieneEstado(502));
  respuesta = { success: false, status: 417, error: 'Insufficient buying power' };
  await assert.rejects(createBrokerOrder(compraAcciones, 'WEBULL'), error => tieneEstado(400)(error) && /Insufficient buying power/.test(error.message));
  respuesta = undefined;
  await assert.rejects(createBrokerOrder(compraAcciones, 'WEBULL'), tieneEstado(503));
});

test('Alpaca: estado y llenado del broker, rechazo 400, respuesta sin id 502 y sin conexión 503', async prueba => {
  let enviar = () => ({ data: { id: 'a-1', status: 'new', filled_qty: '0', qty: '2', symbol: 'AAPL', side: 'buy', type: 'limit', limit_price: '100' } });
  simularAlpaca(prueba, { cuenta: cuentaAlpaca, enviar: cuerpo => enviar(cuerpo) });
  const orden = await createBrokerOrder(compraAcciones, 'ALPACA');
  assert.deepEqual([orden.order.id, orden.order.status, orden.order.filledQty], ['a-1', 'new', 0]);
  assert.doesNotMatch(orden.message, /ejecutad/i);
  enviar = () => { const error = new Error('Request failed'); error.response = { status: 403, data: { message: 'insufficient buying power' } }; throw error; };
  await assert.rejects(createBrokerOrder(compraAcciones, 'ALPACA'), error => tieneEstado(400)(error) && /insufficient buying power/.test(error.message));
  enviar = () => ({ data: {} });
  await assert.rejects(createBrokerOrder(compraAcciones, 'ALPACA'), tieneEstado(502));
  enviar = () => { throw new Error('ECONNRESET'); };
  await assert.rejects(createBrokerOrder(compraAcciones, 'ALPACA'), tieneEstado(503));
});

test('la cancelación solo es exitosa si el broker la confirma', async prueba => {
  let respuesta = { success: false, error: 'Order already filled' };
  simularPuente(prueba, () => respuesta);
  await assert.rejects(cancelBrokerOrder('wb-1', 'WEBULL'), error => tieneEstado(400)(error) && /Order already filled/.test(error.message));
  respuesta = undefined;
  await assert.rejects(cancelBrokerOrder('wb-1', 'WEBULL'), tieneEstado(503));
  respuesta = { success: true, type: 'STOCK', result: { order_id: 'wb-1' } };
  assert.match((await cancelBrokerOrder('wb-1', 'WEBULL')).message, /cancelación/i);

  let cancelar = () => { const error = new Error('x'); error.response = { status: 422, data: { message: 'order is not cancelable' } }; throw error; };
  simularAlpaca(prueba, { cancelar: () => cancelar() });
  await assert.rejects(cancelBrokerOrder('a-1', 'ALPACA'), error => tieneEstado(400)(error) && /not cancelable/.test(error.message));
  cancelar = () => { throw new Error('ETIMEDOUT'); };
  await assert.rejects(cancelBrokerOrder('a-1', 'ALPACA'), tieneEstado(503));
  cancelar = () => ({ status: 204 });
  assert.match((await cancelBrokerOrder('a-1', 'ALPACA')).message, /cancelación/i);
});

test('IBKR distingue la cancelación confirmada de la que TWS aún procesa (PendingCancel)', async prueba => {
  let respuesta = { success: true, status: 'PendingCancel', pending: true };
  simularPuente(prueba, () => respuesta);
  const enCurso = await cancelBrokerOrder('444', 'IBKR');
  assert.equal(enCurso.pending, true);
  assert.match(enCurso.message, /aún no la confirma/);
  respuesta = { success: true, status: 'Cancelled' };
  const confirmada = await cancelBrokerOrder('444', 'IBKR');
  assert.equal(confirmada.pending, undefined);
  assert.match(confirmada.message, /confirmó la cancelación/);
  respuesta = { success: false, status: 502, error: 'estado Filled' };
  await assert.rejects(cancelBrokerOrder('444', 'IBKR'), tieneEstado(502));
});

test('las lecturas no inventan saldos, precios ni listas vacías', async prueba => {
  let cuenta = { success: true, cash: 10, portfolioValue: 10, buyingPower: null, currency: 'USD' };
  let ordenes = { success: false, status: 503, error: 'history no disponible' };
  let cotizacion = { success: true, price: 341.2, bid: null, ask: null };
  simularPuente(prueba, comando => ({ account: cuenta, orders: ordenes, quote: cotizacion })[comando]);
  await assert.rejects(getBrokerAccount('WEBULL'), tieneEstado(502));
  cuenta = { success: true, cash: 10, portfolioValue: 12, buyingPower: 8, currency: 'USD', accountNumber: 'CTA' };
  const leida = await getBrokerAccount('WEBULL');
  assert.deepEqual([leida.cash, leida.portfolioValue, leida.buyingPower, leida.accountId], [10, 12, 8, 'CTA']);
  await assert.rejects(getBrokerOrders('all', 'WEBULL'), tieneEstado(503));
  ordenes = { success: true, orders: [] };
  assert.deepEqual(await getBrokerOrders('all', 'WEBULL'), []);
  const quote = await getBrokerQuote('AAPL', 'WEBULL');
  assert.deepEqual([quote.lastPrice, quote.bid, quote.ask, quote.bidSize, quote.askSize], [341.2, null, null, null, null]);
  assert.equal('volatility' in quote, false);
  assert.equal(quote.companyName, null);

  simularAlpaca(prueba, {
    cuenta: cuentaAlpaca,
    posiciones: () => { throw new Error('timeout'); },
    ordenes: () => { throw new Error('timeout'); },
    snapshot: { latestTrade: { p: 99, t: '2026-11-20T20:59:00Z' } },
  });
  await assert.rejects(getBrokerPositions('ALPACA'), tieneEstado(503));
  await assert.rejects(getBrokerOrders('all', 'ALPACA'), tieneEstado(503));
  const alpaca = await getBrokerQuote('AAPL', 'ALPACA');
  assert.deepEqual([alpaca.lastPrice, alpaca.bid, alpaca.ask, alpaca.companyName], [99, null, null, null]);
});

test('IBKR informa el tipo de instrumento y no usa el costo promedio como precio actual', async prueba => {
  simularPuente(prueba, comando => (comando === 'positions'
    ? { success: true, mode: 'LIVE_TWS_SOCKET', positions: [
      { conId: 1, symbol: 'AAPL', secType: 'STK', quantity: 100, avgCost: 300, costBasis: 30000 },
      { conId: 2, symbol: 'AAPL', secType: 'OPT', quantity: 2, avgCost: 150, costBasis: 300 },
    ] }
    : undefined));
  const [accion, opcion] = await getBrokerPositions('IBKR');
  assert.deepEqual([accion.instrumentType, accion.equityQty, accion.currentPrice, accion.marketValue, accion.avgEntryPrice], ['EQUITY', 100, null, null, 300]);
  assert.deepEqual([opcion.instrumentType, opcion.equityQty], ['OPTION', 0]);
});
