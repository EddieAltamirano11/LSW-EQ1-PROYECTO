import boom from '@hapi/boom';
import { randomUUID } from 'crypto';
import { getHedgingRepo } from '../repositories/hedging.repository.js';
import { cancelBrokerOrder, createBrokerOrder, getBrokerOrders, getBrokerQuote } from './broker.service.js';
import {
  contratoCotizadoPorSimbolo, contratoLiquido, contratosListadosCotizados, elegirCollar, horizonteHasta, obtenerCadenaCobertura,
  obtenerSpotObservado,
} from './cadenaOpciones.service.js';

// Ejecución de coberturas de varias patas (Protective Put y Auto-Collar) con precios observados al ejecutar:
// ask en compras, bid en ventas. Primero el Put; si una pata falla se cancelan las pendientes y no se cierran las ejecutadas.
// Resultado: 201 si todo quedó en el broker, 400 sin guardar si nada quedó vivo, 409 con PARTIALLY_EXECUTED si algo quedó vivo.

const redondear = valor => Number(Number(valor).toFixed(2));
const ESTADOS_EJECUTADOS = ['filled', 'partially_filled', 'partiallyfilled'];

// Put listado con el strike más cercano que sea menor o igual al solicitado.
export function elegirPutListado(contratos, strikeMaximo) {
  return contratos.filter(c => c.type === 'put' && c.strike <= strikeMaximo).sort((a, b) => b.strike - a.strike)[0] ?? null;
}

function conDatos(error, datos) {
  error.output.payload = { ...error.output.payload, ...datos };
  return error;
}

function validarCantidad(valor, { multiploDe100 }) {
  const cantidad = valor === undefined || valor === null || valor === '' ? 100 : Number(valor);
  if (!Number.isInteger(cantidad) || cantidad <= 0) throw boom.badRequest('sharesCount debe ser un entero positivo.');
  if (multiploDe100 && cantidad % 100 !== 0) {
    throw boom.badRequest(`sharesCount debe ser múltiplo de 100 en el Auto-Collar (cada Call cubre 100 acciones); se recibió ${cantidad}.`);
  }
  return cantidad;
}

const estaEjecutada = pata => ESTADOS_EJECUTADOS.includes(String(pata.status ?? '').toLowerCase()) || pata.filledQty > 0;

export function crearCoberturas(dependencias = {}) {
  const d = {
    enviar: createBrokerOrder,
    cancelar: cancelBrokerOrder,
    leerOrdenes: getBrokerOrders,
    cotizar: getBrokerQuote,
    spot: (simbolo, opciones) => obtenerSpotObservado(simbolo, opciones),
    cadena: (simbolo, opciones) => obtenerCadenaCobertura(simbolo, opciones),
    contratoPorSimbolo: (simbolo, opciones) => contratoCotizadoPorSimbolo(simbolo, opciones),
    contratosListados: (simbolo, opciones) => contratosListadosCotizados(simbolo, opciones),
    guardar: (documento, dbTarget) => getHedgingRepo(dbTarget).create(documento),
    validarPortafolio: (portfolioId, dbTarget) => getHedgingRepo(dbTarget).validarPortafolio?.(portfolioId),
    ...dependencias,
  };

  // Lee el libro de órdenes y actualiza estado, cantidad ejecutada y verificación de cada pata aceptada.
  async function verificarEnLibro(patas, broker) {
    let libro = null;
    try {
      libro = await d.leerOrdenes('all', broker);
    } catch {
      libro = null;
    }
    for (const pata of patas.filter(p => p.orderId)) {
      const enLibro = libro?.find(o => String(o.id) === pata.orderId || String(o.clientOrderId ?? '') === pata.orderId);
      pata.verifiedInBroker = Boolean(enLibro);
      if (enLibro) {
        pata.status = enLibro.status ?? pata.status;
        pata.filledQty = enLibro.filledQty ?? pata.filledQty;
      }
    }
  }

  // Envía las patas en orden; ante la primera falla se detiene y compensa.
  async function ejecutarPatas(patas, broker) {
    const resultados = [];
    let falla = null;
    for (const pata of patas) {
      try {
        const respuesta = await d.enviar(pata.orden, broker);
        resultados.push({ ...pata.info, orderId: String(respuesta.order.id), status: respuesta.order.status ?? null,
          filledQty: respuesta.order.filledQty ?? null, brokerMessage: respuesta.message ?? null, accepted: true, verifiedInBroker: false });
      } catch (error) {
        falla = { legRole: pata.info.legRole, message: error.message, statusCode: error.output?.statusCode ?? 500 };
        resultados.push({ ...pata.info, orderId: null, status: null, filledQty: null, brokerMessage: error.message, accepted: false, verifiedInBroker: false });
        break;
      }
    }
    await verificarEnLibro(resultados, broker);
    if (!falla) return { estado: 'COMPLETA', patas: resultados, falla };

    const aceptadas = resultados.filter(p => p.accepted);
    for (const pata of aceptadas) {
      if (estaEjecutada(pata)) {
        pata.cancellation = { requested: false, confirmed: false, message: 'La pata ya tiene ejecución; no se cancela ni se cierra.' };
        continue;
      }
      try {
        const cancelacion = await d.cancelar(pata.orderId, broker);
        pata.cancellation = { requested: true, confirmed: true, message: cancelacion.message ?? null };
      } catch (error) {
        pata.cancellation = { requested: true, confirmed: false, message: error.message };
      }
    }
    if (aceptadas.length) await verificarEnLibro(resultados, broker);
    const vivas = aceptadas.filter(p => estaEjecutada(p) || p.cancellation?.confirmed === false);
    return { estado: vivas.length ? 'PARCIAL' : (aceptadas.length ? 'SIN_RESIDUOS' : 'RECHAZADA'), patas: resultados, falla };
  }

  function legsDelDocumento(ticker, patas) {
    return patas.flatMap(pata => (pata.registro ?? [pata]).map(registro => ({
      legId: `LEG-${ticker}-${registro.legRole}`,
      legRole: registro.legRole,
      assetType: registro.assetType,
      contractSymbol: registro.contractSymbol ?? null,
      optionType: registro.optionType ?? null,
      strike: registro.strike ?? null,
      expirationDate: registro.expirationDate ? new Date(`${registro.expirationDate}T00:00:00.000Z`) : null,
      quantity: registro.quantity,
      entryPrice: registro.limitPrice,
      brokerOrderId: pata.orderId,
      orderStatus: pata.status,
      filledQuantity: pata.filledQty,
      verifiedInBroker: pata.verifiedInBroker,
      accepted: pata.accepted,
      brokerMessage: pata.brokerMessage,
      cancellation: pata.cancellation ?? null,
    })));
  }

  // Responde según el resultado: guarda ACTIVE (201) o PARTIALLY_EXECUTED (409); 400/503 sin guardar si nada quedó vivo.
  async function cerrar({ resultado, broker, dbTarget, documento, descripcion }) {
    const orders = resultado.patas.map(({ registro, ...pata }) => pata);
    if (resultado.estado === 'RECHAZADA') {
      const error = resultado.falla.statusCode >= 500
        ? boom.boomify(new Error(resultado.falla.message), { statusCode: resultado.falla.statusCode === 502 ? 502 : 503 })
        : boom.badRequest(`${broker} rechazó la primera pata (${resultado.falla.legRole}): ${resultado.falla.message}. No se envió nada más ni se guardó la estrategia.`);
      throw conDatos(error, { orders, failure: resultado.falla });
    }
    if (resultado.estado === 'SIN_RESIDUOS') {
      throw conDatos(boom.badRequest(`Falló la pata ${resultado.falla.legRole} en ${broker}: ${resultado.falla.message}. Las patas aceptadas se cancelaron (confirmado por el broker); no se guardó la estrategia.`),
        { orders, failure: resultado.falla });
    }
    const estado = resultado.estado === 'COMPLETA' ? 'ACTIVE' : 'PARTIALLY_EXECUTED';
    const strategy = await d.guardar({ ...documento, status: estado, legs: legsDelDocumento(documento.underlying.symbol, resultado.patas) }, dbTarget);
    if (estado === 'PARTIALLY_EXECUTED') {
      throw conDatos(boom.conflict(`Ejecución parcial en ${broker}: falló la pata ${resultado.falla.legRole} (${resultado.falla.message}) y quedaron patas vivas o ejecutadas. Se guardó como PARTIALLY_EXECUTED con el estado de cada orden.`),
        { orders, failure: resultado.falla, strategy });
    }
    return { message: `${descripcion} enviada a ${broker}: el broker aceptó ${orders.length} órdenes. El llenado se consulta en el libro de órdenes.`, strategy, orders };
  }

  async function precioAcciones(ticker, broker) {
    const cotizacion = await d.cotizar(ticker, broker);
    if (!(cotizacion?.ask > 0)) throw boom.serverUnavailable(`${broker} no informó el ask de ${ticker}; no se envían órdenes sin una cotización observada.`);
    return cotizacion;
  }

  async function protectivePut(payload, dbTarget) {
    const ticker = String(payload.symbol ?? '').toUpperCase();
    if (!ticker) throw boom.badRequest('symbol es obligatorio.');
    const broker = String(payload.broker ?? 'WEBULL').toUpperCase();
    const acciones = validarCantidad(payload.sharesCount ?? payload.sharesQuantity, { multiploDe100: false });
    const contratos = Math.ceil(acciones / 100);
    const comprarAcciones = payload.buyUnderlying !== false;
    // Se valida antes de emitir: un registro que no se pueda guardar no debe dejar órdenes vivas sin estrategia.
    await d.validarPortafolio(payload.portfolioId ?? 'PORT-01', dbTarget);

    let put;
    if (payload.contractSymbol) {
      put = await d.contratoPorSimbolo(String(payload.contractSymbol).toUpperCase(), { ahora: payload.ahora });
    } else {
      const strike = Number(payload.putStrike);
      const vencimiento = payload.expirationDate ? String(payload.expirationDate).slice(0, 10) : null;
      if (!(strike > 0) || !vencimiento) throw boom.badRequest('Indica contractSymbol, o putStrike y expirationDate del Put.');
      put = elegirPutListado(await d.contratosListados(ticker, { tipo: 'put', vencimiento, strikeMaximo: strike, ahora: payload.ahora }), strike);
      if (!put) throw boom.badRequest(`No hay un Put listado de ${ticker} con strike menor o igual a ${strike} para ${vencimiento}.`);
    }
    if (!put || put.type !== 'put') throw boom.badRequest('El contrato indicado no es un Put listado.');
    if (!(put.ask > 0)) throw boom.serverUnavailable(`${put.symbol} no tiene un ask observado vigente.`);
    const cotizacion = comprarAcciones ? await precioAcciones(ticker, broker) : await d.cotizar(ticker, broker);
    const precio = comprarAcciones ? cotizacion.ask : cotizacion.lastPrice;

    const patas = [{
      info: { legRole: 'HEDGE_FLOOR', assetType: 'OPTION', contractSymbol: put.symbol, optionType: 'PUT', strike: put.strike,
        expirationDate: put.expiration, quantity: contratos, limitPrice: put.ask, side: 'buy' },
      orden: { broker, symbol: ticker, contractSymbol: put.symbol, instrumentType: 'OPTION', optionType: 'PUT', strategy: 'SINGLE',
        strikePrice: put.strike, expirationDate: put.expiration, qty: contratos, side: 'buy', type: 'limit', limitPrice: put.ask, timeInForce: 'day' },
    }];
    if (comprarAcciones) {
      patas.push({
        info: { legRole: 'UNDERLYING', assetType: 'EQUITY', quantity: acciones, limitPrice: precio, side: 'buy' },
        orden: { broker, symbol: ticker, instrumentType: 'EQUITY', qty: acciones, side: 'buy', type: 'limit', limitPrice: precio, timeInForce: 'day' },
      });
    }
    const resultado = await ejecutarPatas(patas, broker);
    const documento = {
      id: `STRAT-PP-${ticker}-${randomUUID().slice(0, 4)}`,
      portfolioId: payload.portfolioId ?? 'PORT-01',
      broker,
      strategyType: 'PROTECTIVE_PUT',
      underlying: { symbol: ticker, companyName: cotizacion.companyName ?? ticker, spotPriceAtEntry: precio, sharesCount: acciones },
      financialMetrics: {
        netDebitCredit: redondear(-put.ask * acciones),
        breakevenPrice: redondear(precio + put.ask),
        floorProtectionPrice: put.strike,
        maxLossTotalUSD: redondear((precio - put.strike + put.ask) * acciones),
      },
    };
    return cerrar({ resultado, broker, dbTarget, documento, descripcion: 'Protective Put' });
  }

  async function collarAEjecutar(ticker, params) {
    if (params.putContractSymbol || params.callContractSymbol) {
      // Collar del ranking: se usan esos contratos con cotizaciones nuevas, si siguen cumpliendo la regla del Core 004.
      const [{ spot }, put, call] = await Promise.all([
        d.spot(ticker, { ahora: params.ahora }),
        d.contratoPorSimbolo(String(params.putContractSymbol).toUpperCase(), { ahora: params.ahora }),
        d.contratoPorSimbolo(String(params.callContractSymbol).toUpperCase(), { ahora: params.ahora }),
      ]);
      const causas = [];
      if (put?.type !== 'put' || call?.type !== 'call') causas.push('los contratos no son un Put y un Call listados');
      else {
        if (!contratoLiquido(put)) causas.push(`el Put ${put.symbol} ya no cumple la liquidez del Core 004`);
        if (!contratoLiquido(call)) causas.push(`el Call ${call.symbol} ya no cumple la liquidez del Core 004`);
        if (put.expiration !== call.expiration) causas.push('el Put y el Call tienen vencimientos distintos');
        if (!(put.strike < spot.price && call.strike > spot.price)) causas.push('los strikes ya no quedan fuera del dinero');
        const base = spot.price + put.ask - call.bid;
        if (!(base >= put.strike && base <= call.strike)) causas.push('el costo base ya no queda entre los strikes');
      }
      if (causas.length) throw boom.badRequest(`El collar del ranking ya no es apto: ${causas.join('; ')}. Vuelve a evaluar los cores; no se enviaron órdenes.`);
      return { put, call };
    }
    // Activo sin resultado del Core 004 (por ejemplo SPY): la selección se calcula ahora sobre la cadena real.
    const { spot, cadena } = await d.cadena(ticker, { horizonteDias: horizonteHasta(params.expirationDate, params.ahora), ahora: params.ahora });
    const par = elegirCollar(spot, cadena);
    if (!par) throw boom.badRequest(`No hay un Put y un Call de ${ticker} con liquidez y costo base verificables en la cadena real; no se enviaron órdenes.`);
    return par;
  }

  async function autoCollar(params, dbTarget) {
    const ticker = String(params.symbol ?? '').toUpperCase();
    if (!ticker) throw boom.badRequest('symbol es obligatorio.');
    const broker = String(params.broker ?? 'WEBULL').toUpperCase();
    const acciones = validarCantidad(params.sharesCount, { multiploDe100: true });
    const contratos = acciones / 100;
    const comprarAcciones = params.buyUnderlying !== false;
    await d.validarPortafolio(params.portfolioId ?? 'PORT-01', dbTarget);

    const { put, call } = await collarAEjecutar(ticker, params);
    const cotizacion = comprarAcciones ? await precioAcciones(ticker, broker) : await d.cotizar(ticker, broker);
    const precio = comprarAcciones ? cotizacion.ask : cotizacion.lastPrice;

    const patas = [{
      info: { legRole: 'HEDGE_FLOOR', assetType: 'OPTION', contractSymbol: put.symbol, optionType: 'PUT', strike: put.strike,
        expirationDate: put.expiration, quantity: contratos, limitPrice: put.ask, side: 'buy' },
      orden: { broker, symbol: ticker, contractSymbol: put.symbol, instrumentType: 'OPTION', optionType: 'PUT', strategy: 'SINGLE',
        strikePrice: put.strike, expirationDate: put.expiration, qty: contratos, side: 'buy', type: 'limit', limitPrice: put.ask, timeInForce: 'day' },
    }];
    const pataCall = {
      legRole: 'FINANCE_CEILING', assetType: 'OPTION', contractSymbol: call.symbol, optionType: 'CALL', strike: call.strike,
      expirationDate: call.expiration, quantity: contratos, limitPrice: call.bid, side: 'sell',
    };
    const pataAcciones = { legRole: 'UNDERLYING', assetType: 'EQUITY', quantity: acciones, limitPrice: precio, side: 'buy' };
    if (broker === 'WEBULL' && comprarAcciones) {
      // Webull exige la orden combinada COVERED_STOCK; su limit_price es el neto por acción (acciones − prima del Call),
      // confirmado con preview_option el 2026-11-20 (estimated_cost = limit_price × 100).
      const neto = redondear(precio - call.bid);
      patas.push({
        info: { legRole: 'COVERED_STOCK', assetType: 'OPTION', contractSymbol: call.symbol, optionType: 'CALL', strike: call.strike,
          expirationDate: call.expiration, quantity: contratos, limitPrice: neto, side: 'sell' },
        registro: [pataAcciones, pataCall],
        orden: { broker, symbol: ticker, contractSymbol: call.symbol, instrumentType: 'OPTION', optionType: 'CALL', strategy: 'COVERED_STOCK',
          strikePrice: call.strike, expirationDate: call.expiration, qty: contratos, side: 'sell', type: 'limit', limitPrice: neto,
          stockPrice: precio, timeInForce: 'day' },
      });
    } else {
      if (comprarAcciones) {
        patas.push({ info: pataAcciones, orden: { broker, symbol: ticker, instrumentType: 'EQUITY', qty: acciones, side: 'buy', type: 'limit', limitPrice: precio, timeInForce: 'day' } });
      }
      patas.push({
        info: pataCall,
        orden: { broker, symbol: ticker, contractSymbol: call.symbol, instrumentType: 'OPTION', optionType: 'CALL', strategy: 'SINGLE',
          strikePrice: call.strike, expirationDate: call.expiration, qty: contratos, side: 'sell', type: 'limit', limitPrice: call.bid, timeInForce: 'day' },
      });
    }

    const resultado = await ejecutarPatas(patas, broker);
    const neto = call.bid - put.ask;
    const documento = {
      id: `STRAT-COLLAR-${ticker}-${randomUUID().slice(0, 4)}`,
      portfolioId: params.portfolioId ?? 'PORT-01',
      broker,
      strategyType: 'COLLAR',
      underlying: { symbol: ticker, companyName: cotizacion.companyName ?? ticker, spotPriceAtEntry: precio, sharesCount: acciones },
      financialMetrics: {
        netDebitCredit: redondear(neto * acciones),
        breakevenPrice: redondear(precio - neto),
        floorProtectionPrice: put.strike,
        maxLossTotalUSD: redondear((precio - put.strike - neto) * acciones),
        maxProfitTotalUSD: redondear((call.strike - precio + neto) * acciones),
      },
    };
    return cerrar({ resultado, broker, dbTarget, documento, descripcion: 'Collar' });
  }

  return { ejecutarPatas, protectivePut, autoCollar };
}

export const coberturas = crearCoberturas();
