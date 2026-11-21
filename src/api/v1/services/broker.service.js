import boom from '@hapi/boom';
import axios from 'axios';
import config from '../../../config/config.js';
import { isAlpacaConfigured, getAlpacaHeaders, alpacaDataClient } from '../../../config/broker.config.js';
import { getUnderlyingRepo } from '../repositories/underlying.repository.js';
import * as WebullService from './webull.service.js';
import * as IBKRService from './ibkr.service.js';
import { errorDeBroker, numeroReportado } from './brokerRespuestas.js';
import { FUENTE_CADENA, contratoPublico, horizonteHasta, obtenerCadenaCobertura } from './cadenaOpciones.service.js';

// Órdenes y lecturas fieles al broker: solo se devuelve lo que reporta el broker (null si no lo reporta),
// las órdenes incompletas se rechazan antes de contactarlo y los fallos se informan con 400, 502 o 503.

const elegirBroker = broker => String(broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();
const dinero = valor => `$${Number(valor).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
const OCC = /^([A-Z]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/;
const MULTIPLICADOR_ESTANDAR = 100;

function exigirAlpaca() {
  if (!isAlpacaConfigured()) {
    throw boom.serverUnavailable('Alpaca Markets no está configurado (faltan credenciales ALPACA_API_KEY / ALPACA_SECRET_KEY).');
  }
}

// ---------------------------------------------------------------------------------------------
// Adaptador de Alpaca (los de Webull e IBKR viven en sus servicios)
// ---------------------------------------------------------------------------------------------
const Alpaca = {
  async account() {
    exigirAlpaca();
    try {
      const { data: acc } = await axios.get(`${config.ALPACA_BASE_URL}/v2/account`, { headers: getAlpacaHeaders(), timeout: 5000 });
      return {
        broker: 'ALPACA',
        accountId: acc.id ?? null,
        status: acc.status ?? null,
        currency: acc.currency ?? null,
        cash: numeroReportado(acc.cash),
        portfolioValue: numeroReportado(acc.portfolio_value),
        buyingPower: numeroReportado(acc.buying_power),
        tradingBlocked: acc.trading_blocked ?? null,
        transfersBlocked: acc.transfers_blocked ?? null,
        accountBlocked: acc.account_blocked ?? null,
        createdAt: acc.created_at ?? null,
        source: 'Alpaca Paper Trading Account (Live)',
      };
    } catch (error) {
      throw errorDeBroker('Alpaca Markets', error);
    }
  },

  async quote(ticker) {
    exigirAlpaca();
    let snap;
    try {
      ({ data: snap } = await alpacaDataClient.get(`/stocks/${ticker}/snapshot?feed=iex`, { headers: getAlpacaHeaders() }));
    } catch (error) {
      throw errorDeBroker('Alpaca Markets', error);
    }
    const q = snap?.latestQuote;
    const ultimo = numeroReportado(snap?.latestTrade?.p) ?? numeroReportado(snap?.dailyBar?.c) ?? numeroReportado(snap?.prevDailyBar?.c);
    if (!(ultimo > 0)) throw boom.badGateway(`Alpaca no informó un precio para ${ticker}.`);
    const positivo = valor => (numeroReportado(valor) > 0 ? numeroReportado(valor) : null);
    return {
      broker: 'ALPACA',
      symbol: ticker,
      companyName: null,
      lastPrice: ultimo,
      bid: positivo(q?.bp),
      ask: positivo(q?.ap),
      bidSize: positivo(q?.bs),
      askSize: positivo(q?.as),
      timestamp: snap?.latestTrade?.t ?? q?.t ?? null,
      source: 'Alpaca Market Data v2 (IEX snapshot)',
    };
  },

  async positions() {
    exigirAlpaca();
    try {
      const { data } = await axios.get(`${config.ALPACA_BASE_URL}/v2/positions`, { headers: getAlpacaHeaders(), timeout: 5000 });
      if (!Array.isArray(data)) throw boom.badGateway('Alpaca devolvió posiciones ilegibles.');
      return data.map(pos => {
        const esOpcion = pos.asset_class === 'us_option';
        const qty = numeroReportado(pos.qty);
        return {
          broker: 'ALPACA',
          assetId: pos.asset_id ?? null,
          symbol: pos.symbol,
          instrumentType: esOpcion ? 'OPTION' : 'EQUITY',
          qty,
          equityQty: esOpcion ? 0 : qty,
          side: pos.side ?? null,
          avgEntryPrice: numeroReportado(pos.avg_entry_price),
          currentPrice: numeroReportado(pos.current_price),
          marketValue: numeroReportado(pos.market_value),
          costBasis: numeroReportado(pos.cost_basis),
          unrealizedPL: numeroReportado(pos.unrealized_pl),
          unrealizedPLPercent: numeroReportado(pos.unrealized_plpc) === null ? null : Number((Number(pos.unrealized_plpc) * 100).toFixed(2)),
          changeToday: numeroReportado(pos.change_today) === null ? null : Number((Number(pos.change_today) * 100).toFixed(2)),
          assetClass: pos.asset_class ?? null,
        };
      });
    } catch (error) {
      throw errorDeBroker('Alpaca Markets', error);
    }
  },

  async orders(status) {
    exigirAlpaca();
    try {
      const { data } = await axios.get(`${config.ALPACA_BASE_URL}/v2/orders?status=${status}&limit=20`, { headers: getAlpacaHeaders(), timeout: 5000 });
      if (!Array.isArray(data)) throw boom.badGateway('Alpaca devolvió órdenes ilegibles.');
      return data.map(o => ({
        broker: 'ALPACA',
        id: o.id,
        clientOrderId: o.client_order_id ?? null,
        symbol: o.symbol,
        qty: numeroReportado(o.qty),
        side: o.side ?? null,
        type: o.type ?? null,
        timeInForce: o.time_in_force ?? null,
        limitPrice: numeroReportado(o.limit_price),
        filledQty: numeroReportado(o.filled_qty),
        status: o.status ?? null,
        assetClass: o.asset_class ?? null,
        createdAt: o.created_at ?? null,
        filledAt: o.filled_at ?? null,
      }));
    } catch (error) {
      throw errorDeBroker('Alpaca Markets', error);
    }
  },

  async placeOrder(orden) {
    exigirAlpaca();
    const body = {
      symbol: orden.instrumentType === 'OPTION' ? orden.option.contractSymbol : orden.symbol,
      qty: orden.qty,
      side: orden.side,
      type: orden.type,
      time_in_force: orden.timeInForce,
    };
    if (orden.type === 'limit') body.limit_price = String(orden.limitPrice);
    let data;
    try {
      ({ data } = await axios.post(`${config.ALPACA_BASE_URL}/v2/orders`, body, { headers: getAlpacaHeaders(), timeout: 7000 }));
    } catch (error) {
      throw errorDeBroker('Alpaca Markets', error);
    }
    if (!data?.id) throw boom.badGateway('Alpaca respondió sin identificador de orden.');
    return {
      id: String(data.id),
      clientOrderId: data.client_order_id ?? null,
      status: data.status ?? null,
      filledQty: numeroReportado(data.filled_qty),
      createdAt: data.created_at ?? null,
      source: 'Alpaca Live Trading Engine',
      details: data,
    };
  },

  async cancel(orderId) {
    exigirAlpaca();
    try {
      await axios.delete(`${config.ALPACA_BASE_URL}/v2/orders/${orderId}`, { headers: getAlpacaHeaders(), timeout: 5000 });
    } catch (error) {
      throw errorDeBroker('Alpaca Markets', error);
    }
    return { message: `Alpaca confirmó la cancelación de la orden ${orderId}.` };
  },
};

const ADAPTADORES = {
  ALPACA: Alpaca,
  WEBULL: {
    account: WebullService.getWebullAccount,
    quote: WebullService.getWebullQuote,
    positions: WebullService.getWebullPositions,
    orders: WebullService.getWebullOrders,
    placeOrder: WebullService.createWebullOrder,
    cancel: WebullService.cancelWebullOrder,
  },
  IBKR: {
    account: IBKRService.getIBKRAccount,
    quote: IBKRService.getIBKRQuote,
    positions: IBKRService.getIBKRPositions,
    orders: IBKRService.getIBKROrders,
    placeOrder: IBKRService.createIBKROrder,
    cancel: IBKRService.cancelIBKROrder,
  },
};

function adaptador(broker) {
  const elegido = ADAPTADORES[elegirBroker(broker)];
  if (!elegido) throw boom.badRequest('Selecciona WEBULL, ALPACA o IBKR.');
  return elegido;
}

// ---------------------------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------------------------
export const getBrokerAccount = async (broker = 'WEBULL') => {
  const cuenta = await adaptador(broker).account();
  const faltan = ['cash', 'portfolioValue', 'buyingPower'].filter(campo => !Number.isFinite(cuenta[campo]));
  if (faltan.length) {
    throw boom.badGateway(`${elegirBroker(broker)} no informó ${faltan.join(', ')} en la cuenta; no se usan saldos supuestos.`);
  }
  return cuenta;
};

export const getBrokerQuote = async (symbol, broker = 'WEBULL') => adaptador(broker).quote(String(symbol).toUpperCase());

export const getBrokerPositions = async (broker = 'WEBULL') => adaptador(broker).positions();

export const getBrokerOrders = async (status = 'all', broker = 'WEBULL') => adaptador(broker).orders(status);

// ---------------------------------------------------------------------------------------------
// Validación de órdenes (un solo punto para los tres brokers)
// ---------------------------------------------------------------------------------------------
function leerContratoOcc(simbolo) {
  const partes = OCC.exec(String(simbolo ?? '').toUpperCase());
  if (!partes) return null;
  const [, subyacente, aa, mm, dd, tipo, strike] = partes;
  return { subyacente, expiration: `20${aa}-${mm}-${dd}`, optionType: tipo === 'C' ? 'CALL' : 'PUT', strike: Number(strike) / 1000 };
}

function contratoOcc(subyacente, expiration, optionType, strike) {
  const [aa, mm, dd] = [expiration.slice(2, 4), expiration.slice(5, 7), expiration.slice(8, 10)];
  return `${subyacente}${aa}${mm}${dd}${optionType[0]}${String(Math.round(strike * 1000)).padStart(8, '0')}`;
}

export function validarOrden(payload = {}) {
  const faltan = [];
  const texto = valor => (valor === undefined || valor === null ? '' : String(valor).trim());
  const instrumentType = texto(payload.instrumentType).toUpperCase();
  const side = texto(payload.side).toLowerCase();
  const type = texto(payload.type).toLowerCase();
  const qty = Number(payload.qty);
  const limitPrice = Number(payload.limitPrice ?? payload.limit_price ?? payload.price);
  const timeInForce = (texto(payload.timeInForce ?? payload.time_in_force) || 'day').toLowerCase();

  if (!['EQUITY', 'OPTION'].includes(instrumentType)) faltan.push('instrumentType (EQUITY u OPTION)');
  if (!['buy', 'sell'].includes(side)) faltan.push('side (buy o sell)');
  if (!['market', 'limit'].includes(type)) faltan.push('type (market o limit)');
  if (payload.qty === undefined || payload.qty === null || !Number.isInteger(qty) || qty <= 0) faltan.push('qty (entero positivo)');
  if (type === 'limit' && !(limitPrice > 0)) faltan.push('limitPrice (precio límite positivo en órdenes limit)');
  if (!['day', 'gtc'].includes(timeInForce)) faltan.push('timeInForce (day o gtc)');

  let symbol = texto(payload.symbol).toUpperCase();
  let option = null;
  const strategy = (texto(payload.strategy) || 'SINGLE').toUpperCase();
  let stockPrice = null;
  if (instrumentType === 'OPTION') {
    const occ = leerContratoOcc(payload.contractSymbol);
    if (payload.contractSymbol && !occ) faltan.push('contractSymbol (símbolo OCC válido, por ejemplo AAPL261218P00300000)');
    const optionType = texto(payload.optionType ?? payload.option_type).toUpperCase() || occ?.optionType || '';
    const strike = Number(payload.strikePrice ?? payload.strike_price ?? occ?.strike);
    const expiration = texto(payload.expirationDate ?? payload.expire_date) || occ?.expiration || '';
    symbol = symbol || occ?.subyacente || '';
    if (!['CALL', 'PUT'].includes(optionType)) faltan.push('optionType (CALL o PUT)');
    if (!(strike > 0)) faltan.push('strikePrice (strike del contrato)');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiration)) faltan.push('expirationDate (vencimiento AAAA-MM-DD)');
    if (occ && (occ.optionType !== optionType || occ.strike !== strike || occ.expiration !== expiration || (symbol && occ.subyacente !== symbol))) {
      faltan.push('contractSymbol coherente con optionType, strikePrice, expirationDate y symbol');
    }
    if (!['SINGLE', 'COVERED_STOCK'].includes(strategy)) faltan.push('strategy (SINGLE o COVERED_STOCK)');
    if (strategy === 'COVERED_STOCK') {
      stockPrice = Number(payload.stockPrice ?? payload.spotPrice);
      if (!(stockPrice > 0)) faltan.push('stockPrice (precio de las acciones del COVERED_STOCK)');
    }
    if (['CALL', 'PUT'].includes(optionType) && strike > 0 && /^\d{4}-\d{2}-\d{2}$/.test(expiration) && symbol) {
      option = { optionType, strike, expiration, contractSymbol: occ ? String(payload.contractSymbol).toUpperCase() : contratoOcc(symbol, expiration, optionType, strike) };
    }
  }
  if (!symbol) faltan.push('symbol');

  if (faltan.length) {
    throw boom.badRequest(`Orden incompleta o inválida; no se envió al broker. Revisa: ${faltan.join('; ')}.`);
  }
  return {
    symbol, instrumentType, side, type, qty, timeInForce,
    limitPrice: type === 'limit' ? limitPrice : null,
    option, strategy: instrumentType === 'OPTION' ? strategy : null, stockPrice,
  };
}

// Las lecturas que fallan durante una salvaguarda se informan como 503: sin ellas no se puede validar la orden.
async function leerParaValidar(lectura, descripcion) {
  try {
    return await lectura();
  } catch (error) {
    throw boom.serverUnavailable(`No se emitió la orden: no se pudo leer ${descripcion} (${error.message}).`);
  }
}

async function validarTenencia(orden, broker) {
  const posiciones = await leerParaValidar(() => getBrokerPositions(broker), `las posiciones de ${broker}`);
  const delSimbolo = posiciones.filter(posicion => String(posicion.symbol ?? '').toUpperCase() === orden.symbol);
  if (delSimbolo.some(posicion => posicion.equityQty === null || posicion.equityQty === undefined)) {
    throw boom.badGateway(`${broker} no informó cuántas acciones de ${orden.symbol} hay en sus posiciones; no se emitió la venta.`);
  }
  const acciones = delSimbolo.reduce((suma, posicion) => suma + posicion.equityQty, 0);
  if (orden.qty > acciones) {
    throw boom.badRequest(`Venta rechazada: solicitas ${orden.qty} acciones de ${orden.symbol}, pero ${broker} reporta ${acciones} acciones (los contratos de opciones no cuentan).`);
  }
}

async function validarBuyingPower(orden, broker) {
  const cuenta = await leerParaValidar(() => getBrokerAccount(broker), `el Buying Power de ${broker}`);
  let precio = orden.limitPrice;
  if (orden.type === 'market') {
    if (orden.instrumentType === 'OPTION') {
      throw boom.serverUnavailable('No se emitió la orden: no hay una cotización observada del contrato para estimar una compra de opción a mercado. Usa una orden limit.');
    }
    const cotizacion = await leerParaValidar(() => getBrokerQuote(orden.symbol, broker), `la cotización de ${orden.symbol}`);
    if (!(cotizacion.ask > 0)) {
      throw boom.serverUnavailable(`No se emitió la orden: ${broker} no informó el ask de ${orden.symbol} para estimar la compra a mercado.`);
    }
    precio = cotizacion.ask;
  }
  const costo = orden.qty * precio * (orden.instrumentType === 'OPTION' ? MULTIPLICADOR_ESTANDAR : 1);
  if (costo > cuenta.buyingPower) {
    throw boom.badRequest(`Poder de compra insuficiente en ${broker}: la orden requiere ${dinero(costo)} y el Buying Power disponible es ${dinero(cuenta.buyingPower)}.`);
  }
}

export const createBrokerOrder = async (orderPayload, broker = 'WEBULL') => {
  const orden = validarOrden(orderPayload);
  const destino = elegirBroker(orderPayload?.broker || broker);
  const corredor = adaptador(destino);

  if (orden.instrumentType === 'EQUITY' && orden.side === 'sell') await validarTenencia(orden, destino);
  if (orden.side === 'buy' || orden.strategy === 'COVERED_STOCK') await validarBuyingPower(orden, destino);

  const aceptada = await corredor.placeOrder({ ...orden, dbTarget: orderPayload.dbTarget, database: orderPayload.database });
  return {
    message: `Orden enviada a ${destino}: el broker la aceptó con el identificador ${aceptada.id}. `
      + (aceptada.filledQty > 0 ? `Cantidad ejecutada reportada: ${aceptada.filledQty}.` : 'El llenado se consulta en las órdenes del broker.'),
    order: {
      broker: destino,
      id: aceptada.id,
      clientOrderId: aceptada.clientOrderId ?? null,
      symbol: orden.symbol,
      instrumentType: orden.instrumentType,
      optionType: orden.option?.optionType ?? null,
      strikePrice: orden.option?.strike ?? null,
      expirationDate: orden.option?.expiration ?? null,
      contractSymbol: orden.option?.contractSymbol ?? null,
      strategy: orden.strategy,
      qty: orden.qty,
      side: orden.side,
      type: orden.type,
      timeInForce: orden.timeInForce,
      limitPrice: orden.limitPrice,
      status: aceptada.status ?? null,
      filledQty: aceptada.filledQty ?? null,
      createdAt: aceptada.createdAt ?? null,
      source: aceptada.source ?? null,
      details: aceptada.details ?? null,
    },
  };
};

export const cancelBrokerOrder = async (orderId, broker = 'WEBULL') => {
  if (!String(orderId ?? '').trim()) throw boom.badRequest('Indica el identificador de la orden a cancelar.');
  return adaptador(broker).cancel(String(orderId).trim());
};

/**
 * Cadena de opciones real, la misma para los tres brokers: contratos listados de Alpaca con cotizaciones de Webull OpenAPI.
 * Con `expirationDate` se devuelven solo los contratos de ese vencimiento. Sin contratos cotizados responde 503.
 */
export const getBrokerOptionsChain = async (symbol, expirationDate, broker = 'WEBULL', { ahora } = {}) => {
  const destino = elegirBroker(broker);
  if (!ADAPTADORES[destino]) throw boom.badRequest('Selecciona WEBULL, ALPACA o IBKR.');
  const { simbolo, spot, cadena } = await obtenerCadenaCobertura(symbol, { horizonteDias: horizonteHasta(expirationDate, ahora), ahora });
  const contratos = expirationDate ? cadena.contracts.filter(c => c.expiration === String(expirationDate).slice(0, 10)) : cadena.contracts;
  if (!contratos.length) {
    throw boom.serverUnavailable(`No hay contratos cotizados de ${simbolo} con vencimiento ${expirationDate}; vencimientos cotizados: ${[...new Set(cadena.contracts.map(c => c.expiration))].join(', ')}.`);
  }
  const publicos = contratos.map(contratoPublico);
  return {
    broker: destino,
    symbol: simbolo,
    spotPrice: spot.price,
    spotTime: Number.isFinite(spot.at) ? new Date(spot.at).toISOString() : null,
    expirationDate: expirationDate ? String(expirationDate).slice(0, 10) : null,
    expirations: [...new Set(publicos.map(c => c.expirationDate))],
    source: FUENTE_CADENA,
    contractsCount: publicos.length,
    calls: publicos.filter(c => c.type === 'CALL'),
    puts: publicos.filter(c => c.type === 'PUT'),
  };
};

export const syncUnderlyingFromBroker = async (symbol, dbTarget = 'mongodb', broker = 'WEBULL') => {
  const targetBroker = (broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();
  const quote = await getBrokerQuote(symbol, targetBroker);
  const repo = getUnderlyingRepo(dbTarget);

  let existing = await repo.getBySymbol(symbol);
  if (!existing) {
    existing = await repo.create({
      symbol: quote.symbol,
      companyName: quote.companyName || `${quote.symbol} Inc.`,
      spotPrice: quote.lastPrice,
      volatility: quote.volatility || 0.2,
    });
  } else {
    const id = existing.id || existing._id;
    existing = await repo.update(id, {
      spotPrice: quote.lastPrice,
    });
  }

  return {
    message: `Activo ${symbol} sincronizado exitosamente con el broker ${targetBroker} en ${dbTarget.toUpperCase()}.`,
    broker: targetBroker,
    underlying: existing,
    latestQuote: quote,
  };
};

export default {
  getBrokerAccount,
  getBrokerQuote,
  getBrokerOptionsChain,
  getBrokerPositions,
  getBrokerOrders,
  createBrokerOrder,
  cancelBrokerOrder,
  syncUnderlyingFromBroker,
};
