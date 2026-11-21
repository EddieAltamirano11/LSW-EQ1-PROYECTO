import assert from 'node:assert/strict';
import { test } from 'node:test';
import boom from '@hapi/boom';
import { crearCoberturas, elegirPutListado } from '../src/api/v1/services/coberturas.service.js';
import { createCollarSpread } from '../src/api/v1/services/hedging.service.js';

// Dobles de broker sin red: cada prueba define qué responde el broker a cada pata.
// Los contratos tienen la forma de la cadena real (contratos de Alpaca con cotizaciones de Webull); son datos de prueba.

const contrato = (tipo, strike, cambios = {}) => ({
  symbol: `AAPL261218${tipo === 'put' ? 'P' : 'C'}${String(strike * 1000).padStart(8, '0')}`, underlying: 'AAPL', type: tipo,
  expiration: '2026-12-18', strike, multiplier: 100, standard: true, bid: tipo === 'put' ? 5.9 : 4.9, ask: tipo === 'put' ? 6.1 : 5.1,
  volume: 50, interest: 400, at: Date.parse('2026-11-20T20:59:00Z'), delay: 0, ...cambios,
});
const put215 = contrato('put', 215);
const call240 = contrato('call', 240);

function dobles({ respuestas = {}, cancelaciones = {}, libro = [], cotizacion = { lastPrice: 228, ask: 228.2 }, porSimbolo = {} } = {}) {
  const enviadas = [];
  const canceladas = [];
  const guardadas = [];
  let cotizaciones = 0;
  const deps = {
    enviar: async (orden) => {
      enviadas.push(orden);
      const clave = orden.contractSymbol ?? `${orden.symbol}:${orden.instrumentType}`;
      const respuesta = respuestas[clave] ?? { id: `ord-${enviadas.length}`, status: 'new', filledQty: 0 };
      if (respuesta instanceof Error) throw respuesta;
      return { message: 'aceptada', order: { id: respuesta.id, status: respuesta.status, filledQty: respuesta.filledQty } };
    },
    cancelar: async (id) => {
      canceladas.push(id);
      const resultado = cancelaciones[id];
      if (resultado instanceof Error) throw resultado;
      return { message: `cancelación de ${id} confirmada` };
    },
    leerOrdenes: async () => (typeof libro === 'function' ? libro(canceladas) : libro),
    cotizar: async () => { cotizaciones++; return cotizacion; },
    spot: async () => ({ spot: { price: 228, at: Date.parse('2026-11-20T20:59:00Z') } }),
    cadena: async () => ({ spot: { price: 228 }, cadena: { contracts: [put215, contrato('put', 220), call240, contrato('call', 235)], target: Date.parse('2026-12-18') } }),
    contratoPorSimbolo: async (simbolo) => porSimbolo[simbolo] ?? [put215, call240].find(c => c.symbol === simbolo),
    contratosListados: async () => [contrato('put', 210), put215, contrato('put', 220)],
    guardar: async (documento) => { guardadas.push(documento); return { ...documento, id: 'estrategia-1' }; },
  };
  return { deps, enviadas, canceladas, guardadas, cotizaciones: () => cotizaciones };
}

const estado = codigo => error => error.output?.statusCode === codigo;
const ejecutar = { executeOrders: true, broker: 'ALPACA', symbol: 'AAPL' };

test('Protective Put: si el broker rechaza el Put no se envían acciones ni se guarda (400)', async () => {
  const d = dobles({ respuestas: { [put215.symbol]: boom.badRequest('Alpaca Markets rechazó la solicitud: insufficient options buying power') } });
  const coberturas = crearCoberturas(d.deps);
  await assert.rejects(coberturas.protectivePut({ ...ejecutar, contractSymbol: put215.symbol, sharesCount: 100 }, 'supabase'),
    error => estado(400)(error) && /insufficient options buying power/.test(error.message) && error.output.payload.orders.length === 1);
  assert.deepEqual(d.enviadas.map(o => o.instrumentType), ['OPTION']);
  assert.equal(d.guardadas.length, 0);
});

test('Protective Put: Put aceptado y acciones rechazadas cancela el Put; si se confirma, 400 sin guardar', async () => {
  const d = dobles({ respuestas: { 'AAPL:EQUITY': boom.badRequest('rechazo de acciones') } });
  const coberturas = crearCoberturas(d.deps);
  await assert.rejects(coberturas.protectivePut({ ...ejecutar, contractSymbol: put215.symbol, sharesCount: 100 }, 'supabase'), error => {
    const [putOrden, acciones] = error.output.payload.orders;
    return estado(400)(error) && putOrden.cancellation.confirmed === true && acciones.orderId === null && /rechazo de acciones/.test(acciones.brokerMessage);
  });
  assert.deepEqual(d.canceladas, ['ord-1']);
  assert.equal(d.guardadas.length, 0);
});

test('Protective Put: con la cancelación rechazada se guarda PARTIALLY_EXECUTED y responde 409', async () => {
  const d = dobles({ respuestas: { 'AAPL:EQUITY': boom.badRequest('rechazo de acciones') }, cancelaciones: { 'ord-1': boom.badRequest('Order already filled') } });
  const coberturas = crearCoberturas(d.deps);
  await assert.rejects(coberturas.protectivePut({ ...ejecutar, contractSymbol: put215.symbol, sharesCount: 100 }, 'supabase'), error => {
    const putPata = error.output.payload.orders[0];
    return estado(409)(error) && putPata.cancellation.confirmed === false && /Order already filled/.test(putPata.cancellation.message);
  });
  assert.equal(d.guardadas.length, 1);
  assert.equal(d.guardadas[0].status, 'PARTIALLY_EXECUTED');
  assert.equal(d.guardadas[0].legs.find(l => l.legRole === 'HEDGE_FLOOR').brokerOrderId, 'ord-1');
});

test('Auto-Collar: una pata ya ejecutada no se cierra y la estrategia queda PARTIALLY_EXECUTED (409)', async () => {
  const d = dobles({
    respuestas: { [put215.symbol]: { id: 'put-1', status: 'filled', filledQty: 1 }, 'AAPL:EQUITY': boom.serverUnavailable('Alpaca no respondió') },
    libro: [{ id: 'put-1', status: 'filled', filledQty: 1 }],
  });
  const coberturas = crearCoberturas(d.deps);
  await assert.rejects(coberturas.autoCollar({ ...ejecutar, putContractSymbol: put215.symbol, callContractSymbol: call240.symbol }, 'supabase'),
    error => estado(409)(error) && error.output.payload.orders[0].status === 'filled');
  assert.deepEqual(d.canceladas, []);
  assert.equal(d.guardadas[0].status, 'PARTIALLY_EXECUTED');
  assert.equal(d.enviadas.some(o => o.optionType === 'CALL'), false, 'no se envía el Call después de la falla');
});

test('una orden ausente del libro se informa como no verificada, sin estado inventado', async () => {
  const d = dobles({
    respuestas: { [put215.symbol]: { id: 'p', status: null, filledQty: null }, 'AAPL:EQUITY': { id: 'a', status: 'accepted', filledQty: 0 }, [call240.symbol]: { id: 'c', status: 'new', filledQty: 0 } },
    libro: [{ id: 'a', status: 'new', filledQty: 0 }, { id: 'c', status: 'new', filledQty: 0 }],
  });
  const resultado = await crearCoberturas(d.deps).autoCollar({ ...ejecutar, putContractSymbol: put215.symbol, callContractSymbol: call240.symbol }, 'supabase');
  const put = resultado.orders.find(o => o.legRole === 'HEDGE_FLOOR');
  assert.deepEqual([put.verifiedInBroker, put.status], [false, null]);
  assert.equal(resultado.orders.find(o => o.legRole === 'UNDERLYING').verifiedInBroker, true);
  assert.equal(d.guardadas[0].status, 'ACTIVE');
});

test('Auto-Collar: sharesCount que no es múltiplo de 100 responde 400 antes de cotizar', async () => {
  const d = dobles();
  await assert.rejects(crearCoberturas(d.deps).autoCollar({ ...ejecutar, sharesCount: 10 }, 'supabase'), estado(400));
  assert.equal(d.cotizaciones(), 0);
  assert.equal(d.enviadas.length, 0);
});

test('Protective Put: usa el strike listado más cercano menor o igual y el ask observado, no la prima del cliente', async () => {
  assert.equal(elegirPutListado([contrato('put', 210), put215, contrato('put', 220)], 216).strike, 215);
  assert.equal(elegirPutListado([contrato('put', 220)], 216), null);
  const d = dobles();
  const resultado = await crearCoberturas(d.deps).protectivePut({ ...ejecutar, putStrike: 216, expirationDate: '2026-12-18', putPremium: 4.5, spotPrice: 1, sharesCount: 150 }, 'supabase');
  const [putOrden, acciones] = d.enviadas;
  assert.deepEqual([putOrden.contractSymbol, putOrden.limitPrice, putOrden.qty], [put215.symbol, 6.1, 2]);
  assert.deepEqual([acciones.limitPrice, acciones.qty], [228.2, 150]);
  assert.equal(resultado.orders[0].limitPrice, 6.1);
  assert.equal(resultado.strategy.legs.find(l => l.legRole === 'HEDGE_FLOOR').contractSymbol, 'AAPL261218P00215000');
});

test('Auto-Collar: usa tal cual el collar del ranking con cotizaciones nuevas y responde 400 si dejó de ser apto', async () => {
  const d = dobles();
  await crearCoberturas(d.deps).autoCollar({ ...ejecutar, putContractSymbol: put215.symbol, callContractSymbol: call240.symbol }, 'supabase');
  assert.deepEqual(d.enviadas.map(o => [o.contractSymbol ?? o.symbol, o.side, o.limitPrice]),
    [[put215.symbol, 'buy', 6.1], ['AAPL', 'buy', 228.2], [call240.symbol, 'sell', 4.9]]);
  assert.deepEqual(d.enviadas.map(o => o.qty), [1, 100, 1]);

  const sinLiquidez = dobles({ porSimbolo: { [call240.symbol]: { ...call240, interest: 0 } } });
  await assert.rejects(crearCoberturas(sinLiquidez.deps).autoCollar({ ...ejecutar, putContractSymbol: put215.symbol, callContractSymbol: call240.symbol }, 'supabase'),
    error => estado(400)(error) && /ya no es apto/.test(error.message));
  assert.equal(sinLiquidez.enviadas.length, 0);
});

test('Auto-Collar sin resultado del Core 004 calcula la selección sobre la cadena real', async () => {
  const d = dobles();
  await crearCoberturas(d.deps).autoCollar({ ...ejecutar, symbol: 'AAPL' }, 'supabase');
  const contratos = d.enviadas.filter(o => o.instrumentType === 'OPTION').map(o => o.contractSymbol);
  assert.equal(contratos.length, 2);
  assert.ok(contratos.every(s => [put215, call240, contrato('put', 220), contrato('call', 235)].some(c => c.symbol === s)));
});

test('Auto-Collar en Webull: primero el Put y después el COVERED_STOCK con límite neto (acciones − prima del Call)', async () => {
  const d = dobles();
  await crearCoberturas(d.deps).autoCollar({ ...ejecutar, broker: 'WEBULL', putContractSymbol: put215.symbol, callContractSymbol: call240.symbol }, 'supabase');
  assert.deepEqual(d.enviadas.map(o => o.strategy), ['SINGLE', 'COVERED_STOCK']);
  const combo = d.enviadas[1];
  assert.equal(combo.limitPrice, Number((228.2 - 4.9).toFixed(2)));
  assert.equal(combo.stockPrice, 228.2);
});

test('el collar manual exige las primas de ambas patas', async () => {
  await assert.rejects(createCollarSpread({ symbol: 'AAPL', spotPrice: 228, putStrike: 215, callStrike: 240, putPremium: 6.1, expirationDate: '2026-12-18' }, 'supabase'), estado(400));
});

test('un portfolioId que Supabase no puede guardar se rechaza antes de emitir órdenes', async () => {
  const d = dobles();
  delete d.deps.validarPortafolio; // se usa la validación real del repositorio de Supabase (sin red)
  const coberturas = crearCoberturas(d.deps);
  await assert.rejects(coberturas.autoCollar({ ...ejecutar, sharesCount: 100, portfolioId: 'PORT-AAPL' }, 'supabase'),
    error => estado(400)(error) && /portfolioId/.test(error.message));
  await assert.rejects(coberturas.protectivePut({ ...ejecutar, contractSymbol: put215.symbol, sharesCount: 100, portfolioId: 'PORT-AAPL' }, 'supabase'),
    estado(400));
  assert.equal(d.enviadas.length, 0);
  assert.equal(d.guardadas.length, 0);
  // El portafolio por defecto de la aplicación sí es válido en Supabase; en MongoDB el texto es libre.
  await coberturas.protectivePut({ ...ejecutar, contractSymbol: put215.symbol, sharesCount: 100 }, 'supabase');
  await coberturas.protectivePut({ ...ejecutar, contractSymbol: put215.symbol, sharesCount: 100, portfolioId: 'PORT-AAPL' }, 'mongodb');
  assert.equal(d.guardadas.length, 2);
});
