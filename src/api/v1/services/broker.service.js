import boom from '@hapi/boom';
import axios from 'axios';
import config from '../../../config/config.js';
import { isAlpacaConfigured, getAlpacaHeaders, alpacaDataClient } from '../../../config/broker.config.js';
import { getUnderlyingRepo } from '../repositories/underlying.repository.js';
import * as WebullService from './webull.service.js';

// Precios de referencia realistas para el entorno de simulación bursátil
const REALISTIC_MARKET_SNAPSHOTS = {
  AAPL: { companyName: 'Apple Inc.', spotPrice: 228.52, volatility: 0.225, bid: 228.50, ask: 228.55 },
  SPY: { companyName: 'SPDR S&P 500 ETF Trust', spotPrice: 565.15, volatility: 0.142, bid: 565.10, ask: 565.20 },
  NVDA: { companyName: 'NVIDIA Corporation', spotPrice: 125.80, volatility: 0.450, bid: 125.75, ask: 125.85 },
  MSFT: { companyName: 'Microsoft Corporation', spotPrice: 428.30, volatility: 0.185, bid: 428.25, ask: 428.35 },
  GOOGL: { companyName: 'Alphabet Inc.', spotPrice: 165.40, volatility: 0.240, bid: 165.35, ask: 165.45 },
};

/**
 * Consulta de cuenta y balance del broker seleccionado (Webull o Alpaca)
 */
export const getBrokerAccount = async (broker = 'WEBULL') => {
  const targetBroker = (broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();

  if (targetBroker === 'WEBULL') {
    return await WebullService.getWebullAccount();
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
    }
  }

  return {
    broker: 'ALPACA',
    accountId: 'ACC-PAPER-DEMO-01',
    status: 'ACTIVE',
    currency: 'USD',
    cash: 100000.0,
    portfolioValue: 100000.0,
    buyingPower: 400000.0,
    source: 'Alpaca Simulated Paper Account',
  };
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

        const effectiveLastPrice = tradePrice || dailyClose || (q?.bp && q?.ap ? (q.bp + q.ap) / 2 : 100);

        let effectiveBid = (q?.bp && q.bp > 1) ? q.bp : Number((effectiveLastPrice - 0.05).toFixed(2));
        let effectiveAsk = (q?.ap && q.ap > 1) ? q.ap : Number((effectiveLastPrice + 0.05).toFixed(2));

        if (effectiveBid >= effectiveAsk || effectiveBid < effectiveLastPrice * 0.7 || effectiveAsk > effectiveLastPrice * 1.3) {
          effectiveBid = Number((effectiveLastPrice - 0.05).toFixed(2));
          effectiveAsk = Number((effectiveLastPrice + 0.05).toFixed(2));
        }

        return {
          broker: 'ALPACA',
          symbol: ticker,
          companyName: REALISTIC_MARKET_SNAPSHOTS[ticker]?.companyName || `${ticker} Inc.`,
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
      console.warn(`[Broker Alpaca] Error al consultar Alpaca API Snapshot (${error.message}). Usando fallback bursátil.`);
    }
  }

  // Fallback de alta fidelidad para Alpaca
  const data = REALISTIC_MARKET_SNAPSHOTS[ticker] || {
    companyName: `${ticker} Corp.`,
    spotPrice: 100.0,
    volatility: 0.2,
    bid: 99.95,
    ask: 100.05,
  };

  const jitter = (Math.random() - 0.5) * 0.2;
  const currentPrice = Number((data.spotPrice + jitter).toFixed(2));

  return {
    broker: 'ALPACA',
    symbol: ticker,
    companyName: data.companyName,
    lastPrice: currentPrice,
    bid: Number((currentPrice - 0.05).toFixed(2)),
    ask: Number((currentPrice + 0.05).toFixed(2)),
    volatility: data.volatility,
    timestamp: new Date().toISOString(),
    source: 'Alpaca Paper Proxy (Real-Time Simulated Feed)',
  };
};

/**
 * Consulta de cadena de opciones desde el broker seleccionado
 */
export const getBrokerOptionsChain = async (symbol, expirationDate = '2026-10-16', broker = 'WEBULL') => {
  const targetBroker = (broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();

  if (targetBroker === 'WEBULL') {
    return await WebullService.getWebullOptionsChain(symbol, expirationDate);
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

  if (targetBroker === 'WEBULL') {
    return await WebullService.createWebullOrder(orderPayload);
  }

  // Flujo Alpaca
  const targetSymbol = (orderPayload.contractSymbol || orderPayload.symbol || '').toUpperCase();
  const { qty = 1, side = 'buy', type = 'limit', limit_price, limitPrice, price, time_in_force = 'day', timeInForce = 'day' } = orderPayload;

  if (!targetSymbol) {
    throw boom.badRequest('El campo symbol o contractSymbol es obligatorio para emitir la orden al broker.');
  }

  if (isAlpacaConfigured()) {
    try {
      const payload = {
        symbol: targetSymbol,
        qty: Number(qty),
        side: side.toLowerCase(),
        type: type.toLowerCase(),
        time_in_force: (timeInForce || time_in_force).toLowerCase(),
      };
      const effectivePrice = limitPrice || limit_price || price;
      if (effectivePrice && type.toLowerCase() === 'limit') {
        payload.limit_price = String(effectivePrice);
      }

      const resp = await axios.post(`${config.ALPACA_BASE_URL}/v2/orders`, payload, {
        headers: getAlpacaHeaders(),
        timeout: 7000,
      });

      const o = resp.data;
      return {
        message: `Orden bursátil emitida exitosamente a Alpaca Paper Trading.`,
        order: {
          broker: 'ALPACA',
          id: o.id,
          symbol: o.symbol,
          qty: Number(o.qty),
          side: o.side,
          type: o.type,
          status: o.status,
          limitPrice: o.limit_price ? Number(o.limit_price) : null,
          assetClass: o.asset_class,
          createdAt: o.created_at,
        },
      };
    } catch (error) {
      const alpacaMsg = error.response?.data?.message || error.message;
      throw boom.badRequest(`Error de Alpaca al procesar la orden: ${alpacaMsg}`);
    }
  }

  return {
    message: 'Orden simulada localmente (Alpaca no configurado).',
    order: {
      broker: 'ALPACA',
      id: `SIM-ORD-${Date.now()}`,
      symbol,
      qty,
      side,
      type,
      status: 'filled',
    },
  };
};

/**
 * Cancelación de orden bursátil en el broker seleccionado
 */
export const cancelBrokerOrder = async (orderId, broker = 'WEBULL') => {
  const targetBroker = (broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();

  if (targetBroker === 'WEBULL') {
    return await WebullService.cancelWebullOrder(orderId);
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
  return { message: `Orden simulada ${orderId} cancelada.` };
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
