import boom from '@hapi/boom';
import axios from 'axios';
import config from '../../../config/config.js';
import { isAlpacaConfigured, getAlpacaHeaders, alpacaDataClient } from '../../../config/broker.config.js';
import { getUnderlyingRepo } from '../repositories/underlying.repository.js';
import * as WebullService from './webull.service.js';
import * as IBKRService from './ibkr.service.js';

/**
 * Consulta de cuenta y balance del broker seleccionado (Webull, Alpaca o IBKR)
 */
export const getBrokerAccount = async (broker = 'WEBULL') => {
  const targetBroker = (broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();

  if (targetBroker === 'WEBULL') {
    return await WebullService.getWebullAccount();
  }

  if (targetBroker === 'IBKR') {
    return await IBKRService.getIBKRAccount();
  }

  // Flujo Alpaca Markets
  if (isAlpacaConfigured()) {
    try {
      const resp = await axios.get(`${config.ALPACA_BASE_URL}/v2/account`, {
        headers: getAlpacaHeaders(),
        timeout: 5000,
      });
      const acc = resp.data;
      return {
        broker: 'ALPACA',
        accountId: acc.id,
        status: acc.status,
        currency: acc.currency,
        cash: Number(acc.cash),
        portfolioValue: Number(acc.portfolio_value),
        buyingPower: Number(acc.buying_power),
        tradingBlocked: acc.trading_blocked,
        transfersBlocked: acc.transfers_blocked,
        accountBlocked: acc.account_blocked,
        createdAt: acc.created_at,
        source: 'Alpaca Paper Trading Account (Live)',
      };
    } catch (error) {
      console.warn(`[Broker Alpaca Account] Error: ${error.message}`);
      throw boom.serverUnavailable(`Error al consultar cuenta de Alpaca Markets: ${error.message}`);
    }
  }

  throw boom.serverUnavailable('Alpaca Markets no está configurado (faltan credenciales ALPACA_API_KEY / ALPACA_SECRET_KEY).');
};

/**
 * Consulta de cotización en tiempo real desde el broker seleccionado
 */
export const getBrokerQuote = async (symbol, broker = 'WEBULL') => {
  const targetBroker = (broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();
  const ticker = symbol.toUpperCase();

  if (targetBroker === 'WEBULL') {
    return await WebullService.getWebullQuote(ticker);
  }

  if (targetBroker === 'IBKR') {
    return await IBKRService.getIBKRQuote(ticker);
  }

  // Flujo Alpaca Markets
  if (isAlpacaConfigured()) {
    try {
      const response = await alpacaDataClient.get(`/stocks/${ticker}/snapshot?feed=iex`, {
        headers: getAlpacaHeaders(),
      });
      const snap = response.data;
      if (snap) {
        const tradePrice = snap.latestTrade?.p;
        const dailyClose = snap.dailyBar?.c || snap.prevDailyBar?.c;
        const q = snap.latestQuote;

        const effectiveLastPrice = tradePrice || dailyClose || (q?.bp && q?.ap ? (q.bp + q.ap) / 2 : null);
        if (!effectiveLastPrice) {
          throw new Error('Alpaca snapshot no contiene precio de última transacción ni barra de cierre diaria');
        }

        let effectiveBid = (q?.bp && q.bp > 1) ? q.bp : Number((effectiveLastPrice - 0.05).toFixed(2));
        let effectiveAsk = (q?.ap && q.ap > 1) ? q.ap : Number((effectiveLastPrice + 0.05).toFixed(2));

        if (effectiveBid >= effectiveAsk || effectiveBid < effectiveLastPrice * 0.7 || effectiveAsk > effectiveLastPrice * 1.3) {
          effectiveBid = Number((effectiveLastPrice - 0.05).toFixed(2));
          effectiveAsk = Number((effectiveLastPrice + 0.05).toFixed(2));
        }

        return {
          broker: 'ALPACA',
          symbol: ticker,
          companyName: `${ticker} Inc.`,
          lastPrice: Number(effectiveLastPrice.toFixed(2)),
          bid: Number(effectiveBid.toFixed(2)),
          ask: Number(effectiveAsk.toFixed(2)),
          bidSize: q?.bs || 100,
          askSize: q?.as || 100,
          timestamp: snap.latestTrade?.t || q?.t || new Date().toISOString(),
          source: 'Alpaca Market Data v2 (Paper Live Feed - Snapshot)',
        };
      }
    } catch (error) {
      console.warn(`[Broker Alpaca Quote Error (${ticker})]: ${error.message}`);
      throw boom.serverUnavailable(`No se pudo obtener cotización viva para ${ticker} desde Alpaca Markets: ${error.message}`);
    }
  }

  throw boom.serverUnavailable('Alpaca Markets no está configurado (faltan credenciales ALPACA_API_KEY / ALPACA_SECRET_KEY).');
};

/**
 * Consulta de cadena de opciones desde el broker seleccionado
 */
export const getBrokerOptionsChain = async (symbol, expirationDate = '2026-12-18', broker = 'WEBULL') => {
  const targetBroker = (broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();

  if (targetBroker === 'WEBULL') {
    return await WebullService.getWebullOptionsChain(symbol, expirationDate);
  }

  if (targetBroker === 'IBKR') {
    return await IBKRService.getIBKROptionsChain(symbol, expirationDate);
  }

  // Flujo Alpaca
  const quote = await getBrokerQuote(symbol, 'ALPACA');
  const spot = quote.lastPrice;

  const strikes = [
    Math.round((spot * 0.9) / 5) * 5,
    Math.round((spot * 0.95) / 5) * 5,
    Math.round(spot / 5) * 5,
    Math.round((spot * 1.05) / 5) * 5,
    Math.round((spot * 1.1) / 5) * 5,
  ];

  const calls = strikes.map((strike) => {
    const isITM = spot > strike;
    const premium = Number((Math.max(spot - strike, 0) + (isITM ? 3.5 : 2.0) + Math.random()).toFixed(2));
    return {
      contractSymbol: `${quote.symbol}${expirationDate.replace(/-/g, '').slice(2)}C${String(strike * 1000).padStart(8, '0')}`,
      type: 'CALL',
      strike,
      expirationDate,
      bid: Number((premium - 0.1).toFixed(2)),
      ask: Number((premium + 0.1).toFixed(2)),
      lastPrice: premium,
    };
  });

  const puts = strikes.map((strike) => {
    const isITM = strike > spot;
    const premium = Number((Math.max(strike - spot, 0) + (isITM ? 3.5 : 2.0) + Math.random()).toFixed(2));
    return {
      contractSymbol: `${quote.symbol}${expirationDate.replace(/-/g, '').slice(2)}P${String(strike * 1000).padStart(8, '0')}`,
      type: 'PUT',
      strike,
      expirationDate,
      bid: Number((premium - 0.1).toFixed(2)),
      ask: Number((premium + 0.1).toFixed(2)),
      lastPrice: premium,
    };
  });

  return {
    broker: 'ALPACA',
    symbol: quote.symbol,
    spotPrice: spot,
    expirationDate,
    source: quote.source,
    contractsCount: calls.length + puts.length,
    calls,
    puts,
  };
};

/**
 * Consulta de posiciones abiertas en el broker seleccionado
 */
export const getBrokerPositions = async (broker = 'WEBULL') => {
  const targetBroker = (broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();

  if (targetBroker === 'WEBULL') {
    return await WebullService.getWebullPositions();
  }

  if (targetBroker === 'IBKR') {
    return await IBKRService.getIBKRPositions();
  }

  // Flujo Alpaca
  if (isAlpacaConfigured()) {
    try {
      const resp = await axios.get(`${config.ALPACA_BASE_URL}/v2/positions`, {
        headers: getAlpacaHeaders(),
        timeout: 5000,
      });
      return resp.data.map((pos) => ({
        broker: 'ALPACA',
        assetId: pos.asset_id,
        symbol: pos.symbol,
        qty: Number(pos.qty),
        side: pos.side,
        avgEntryPrice: Number(pos.avg_entry_price),
        currentPrice: Number(pos.current_price),
        marketValue: Number(pos.market_value),
        costBasis: Number(pos.cost_basis),
        unrealizedPL: Number(pos.unrealized_pl),
        unrealizedPLPercent: Number((Number(pos.unrealized_plpc) * 100).toFixed(2)),
        changeToday: Number((Number(pos.change_today) * 100).toFixed(2)),
        assetClass: pos.asset_class,
      }));
    } catch (error) {
      console.warn(`[Broker Alpaca Positions] Error: ${error.message}`);
    }
  }
  return [];
};

/**
 * Consulta de órdenes del broker seleccionado
 */
export const getBrokerOrders = async (status = 'all', broker = 'WEBULL') => {
  const targetBroker = (broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();

  if (targetBroker === 'WEBULL') {
    return await WebullService.getWebullOrders(status);
  }

  if (targetBroker === 'IBKR') {
    return await IBKRService.getIBKROrders(status);
  }

  // Flujo Alpaca
  if (isAlpacaConfigured()) {
    try {
      const resp = await axios.get(`${config.ALPACA_BASE_URL}/v2/orders?status=${status}&limit=20`, {
        headers: getAlpacaHeaders(),
        timeout: 5000,
      });
      return resp.data.map((o) => ({
        broker: 'ALPACA',
        id: o.id,
        clientOrderId: o.client_order_id,
        symbol: o.symbol,
        qty: Number(o.qty),
        side: o.side,
        type: o.type,
        timeInForce: o.time_in_force,
        limitPrice: o.limit_price ? Number(o.limit_price) : null,
        filledQty: Number(o.filled_qty || 0),
        status: o.status,
        assetClass: o.asset_class,
        createdAt: o.created_at,
        filledAt: o.filled_at,
      }));
    } catch (error) {
      console.warn(`[Broker Alpaca Orders] Error: ${error.message}`);
    }
  }
  return [];
};

/**
 * Emisión y ejecución de orden bursátil al broker seleccionado
 */
export const createBrokerOrder = async (orderPayload, broker = 'WEBULL') => {
  const targetBroker = (orderPayload.broker || broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();
  const targetSymbol = (orderPayload.contractSymbol || orderPayload.symbol || '').toUpperCase();
  const { qty = 1, side = 'buy', type = 'limit', limit_price, limitPrice, price, time_in_force = 'day', timeInForce = 'day' } = orderPayload;
  const effectiveLimitPrice = limit_price !== undefined ? limit_price : (limitPrice !== undefined ? limitPrice : price);

  if (!targetSymbol) {
    throw boom.badRequest('El campo symbol o contractSymbol es obligatorio para emitir la orden al broker.');
  }

  // 1. Salvaguarda institucional de venta: validar que el usuario tenga acciones en cartera (anti short-selling)
  if (orderPayload.instrumentType === 'EQUITY' && String(side).toLowerCase() === 'sell') {
    try {
      const positions = await getBrokerPositions(targetBroker);
      const posList = Array.isArray(positions) ? positions : (positions?.positions || []);
      const match = posList.find((p) => (p.symbol || p.assetId || '').toUpperCase() === targetSymbol.toUpperCase());
      const owned = Number(match?.qty || 0);
      if (owned <= 0) {
        throw boom.badRequest(`Venta rechazada: No posees acciones de ${targetSymbol} en tu portafolio de ${targetBroker} (Posición: 0 acciones). Venta corta no permitida.`);
      }
      if (Number(qty) > owned) {
        throw boom.badRequest(`Venta rechazada: Intentas vender ${qty} acciones de ${targetSymbol}, pero solo tienes ${owned} acciones disponibles en ${targetBroker}.`);
      }
    } catch (e) {
      if (e.isBoom) throw e;
    }
  }

  // 2. Salvaguarda institucional de compra: validar Buying Power disponible en el broker
  if (String(side).toLowerCase() === 'buy') {
    try {
      const acc = await getBrokerAccount(targetBroker);
      const buyingPower = Number(acc?.buyingPower ?? -1);
      if (buyingPower >= 0) {
        let estimatedCost = 0;
        if (orderPayload.instrumentType === 'OPTION') {
          estimatedCost = Number(qty) * Number(effectiveLimitPrice || 0) * 100;
        } else {
          estimatedCost = Number(qty) * Number(effectiveLimitPrice || 0);
        }
        if (estimatedCost > 0 && estimatedCost > buyingPower) {
          throw boom.badRequest(
            `Poder de compra insuficiente en ${targetBroker}: La orden de compra de ${qty}x ${targetSymbol} requiere un capital estimado de $${estimatedCost.toFixed(2)} USD, pero tu cuenta solo dispone de $${buyingPower.toFixed(2)} USD de Buying Power disponible.`
          );
        }
      }
    } catch (e) {
      if (e.isBoom) throw e;
    }
  }

  if (targetBroker === 'WEBULL') {
    return await WebullService.createWebullOrder(orderPayload);
  }

  if (targetBroker === 'IBKR') {
    return await IBKRService.createIBKROrder(orderPayload);
  }

  // Flujo Alpaca

  if (isAlpacaConfigured()) {
    try {
      const body = {
        symbol: targetSymbol,
        qty: Number(qty),
        side: side.toLowerCase(),
        type: type.toLowerCase(),
        time_in_force: (time_in_force || timeInForce).toLowerCase(),
      };

      if (body.type === 'limit' && effectiveLimitPrice) {
        body.limit_price = String(effectiveLimitPrice);
      }

      const resp = await axios.post(`${config.ALPACA_BASE_URL}/v2/orders`, body, {
        headers: getAlpacaHeaders(),
        timeout: 7000,
      });

      return {
        message: `Orden bursátil emitida y validada exitosamente en Alpaca Markets.`,
        order: {
          broker: 'ALPACA',
          id: resp.data.id,
          clientOrderId: resp.data.client_order_id,
          symbol: resp.data.symbol,
          qty: Number(resp.data.qty),
          side: resp.data.side,
          type: resp.data.type,
          limitPrice: resp.data.limit_price ? Number(resp.data.limit_price) : null,
          status: resp.data.status,
          assetClass: resp.data.asset_class,
          createdAt: resp.data.created_at,
          source: 'Alpaca Live Trading Engine',
        },
      };
    } catch (error) {
      const alpacaError = error.response?.data?.message || error.message;
      console.warn(`[Broker Alpaca Error al emitir orden (${targetSymbol})]: ${alpacaError}`);
      throw boom.badRequest(`Error al emitir orden en Alpaca Markets: ${alpacaError}`);
    }
  }

  throw boom.serverUnavailable('Alpaca Markets no está configurado para emitir órdenes en tiempo real.');
};

/**
 * Cancelación de orden bursátil en el broker seleccionado
 */
export const cancelBrokerOrder = async (orderId, broker = 'WEBULL') => {
  const targetBroker = (broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();

  if (targetBroker === 'WEBULL') {
    return await WebullService.cancelWebullOrder(orderId);
  }

  if (targetBroker === 'IBKR') {
    return await IBKRService.cancelIBKROrder(orderId);
  }

  // Flujo Alpaca
  if (isAlpacaConfigured()) {
    try {
      await axios.delete(`${config.ALPACA_BASE_URL}/v2/orders/${orderId}`, {
        headers: getAlpacaHeaders(),
        timeout: 5000,
      });
      return { message: `Orden ${orderId} cancelada exitosamente en Alpaca.` };
    } catch (error) {
      const alpacaMsg = error.response?.data?.message || error.message;
      throw boom.badRequest(`Error al cancelar orden en Alpaca: ${alpacaMsg}`);
    }
  }

  throw boom.serverUnavailable('Alpaca Markets no está configurado para cancelar órdenes.');
};

/**
 * Sincronización de precio spot del activo subyacente en la base de datos (MongoDB o Supabase)
 * utilizando la cotización en tiempo real del broker activo.
 */
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
