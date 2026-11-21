import boom from '@hapi/boom';
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import config from '../../../config/config.js';
import { isWebullConfigured } from '../../../config/webull.config.js';
import { exigirPuente, numeroReportado } from './brokerRespuestas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRIDGE_SCRIPT = path.join(__dirname, '../../../../scripts/webull_desktop_bridge.py');

/**
 * Ejecuta un comando en el bridge Python oficial de Webull OpenAPI
 */
export const runBridge = (command, args = []) => {
  try {
    const defaultPython = fs.existsSync(path.join(process.cwd(), '.venv/bin/python3'))
      ? path.join(process.cwd(), '.venv/bin/python3')
      : (process.platform === 'win32' ? 'python' : 'python3');
    const pythonCmd = process.env.PYTHON_BIN || defaultPython;
    const result = spawnSync(pythonCmd, [BRIDGE_SCRIPT, command, ...args], {
      encoding: 'utf-8',
      timeout: 15000,
      env: {
        ...process.env,
        WEBULL_APP_KEY: config.WEBULL_APP_KEY || '',
        WEBULL_APP_SECRET: config.WEBULL_APP_SECRET || '',
        WEBULL_ACCOUNT_ID: config.WEBULL_ACCOUNT_ID || '',
      },
    });
    if (result.stdout) {
      const lines = result.stdout.trim().split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('{') && line.endsWith('}')) {
          return JSON.parse(line);
        }
      }
      return JSON.parse(result.stdout.trim());
    }
  } catch (e) {
    console.warn(`[Webull Desktop Bridge Error] (${command}): ${e.message}`);
  }
  return null;
};

/**
 * Cuenta de Webull: solo los saldos que reporta el broker; los que falten quedan en null.
 */
export const getWebullAccount = async () => {
  const cuenta = exigirPuente('Webull', runBridge('account'));
  return {
    broker: 'WEBULL',
    accountId: cuenta.accountNumber ?? null,
    internalAccountId: cuenta.accountId ?? null,
    status: null,
    currency: cuenta.currency ?? null,
    cash: numeroReportado(cuenta.cash),
    portfolioValue: numeroReportado(cuenta.portfolioValue),
    buyingPower: numeroReportado(cuenta.buyingPower),
    unrealizedPL: numeroReportado(cuenta.unrealizedPL),
    dayPL: numeroReportado(cuenta.dayPL),
    tradingBlocked: null,
    source: 'Webull OpenAPI',
  };
};

/**
 * Cotización de Webull: bid y ask solo si el broker los informa; nunca se derivan del último precio.
 */
export const getWebullQuote = async (symbol) => {
  const ticker = symbol.toUpperCase();
  const cotizacion = exigirPuente('Webull', runBridge('quote', ['--symbol', ticker]));
  const ultimo = numeroReportado(cotizacion.price);
  if (!(ultimo > 0)) throw boom.badGateway(`Webull no informó un precio para ${ticker}.`);
  const positivo = valor => (numeroReportado(valor) > 0 ? numeroReportado(valor) : null);
  return {
    broker: 'WEBULL',
    symbol: ticker,
    companyName: null,
    lastPrice: ultimo,
    bid: positivo(cotizacion.bid),
    ask: positivo(cotizacion.ask),
    high: positivo(cotizacion.high),
    low: positivo(cotizacion.low),
    open: positivo(cotizacion.open),
    close: positivo(cotizacion.close),
    peRatio: numeroReportado(cotizacion.peRatio),
    bidSize: positivo(cotizacion.bidSize),
    askSize: positivo(cotizacion.askSize),
    timestamp: cotizacion.timestamp ?? null,
    source: 'Webull OpenAPI (snapshot)',
  };
};

// Webull agrupa las posiciones por estrategia (muestra del 2026-11-20): el tipo real está en cada pata.
// En COVERED_STOCK la pata EQUITY no trae cantidad; las acciones son quantity × option_contract_deliverable.
function accionesDePosicion(posicion, qty) {
  const tipo = String(posicion.instrument_type ?? '').toUpperCase();
  const patas = Array.isArray(posicion.legs) ? posicion.legs : [];
  if (!patas.length) return tipo === 'EQUITY' ? qty : tipo === 'OPTION' ? 0 : null;
  const pataAcciones = patas.find(pata => String(pata.instrument_type).toUpperCase() === 'EQUITY');
  const pataOpcion = patas.find(pata => String(pata.instrument_type).toUpperCase() === 'OPTION');
  if (!pataAcciones) return 0;
  if (!pataOpcion) return qty;
  const entregables = numeroReportado(pataOpcion.option_contract_deliverable);
  return entregables > 0 && qty !== null ? qty * entregables : null;
}

// Tipo de contrato que Webull informa en la posición: en opciones, qty son contratos o combos y equityQty las acciones.
export function contratoDePosicionWebull(p) {
  const qty = numeroReportado(p.quantity);
  return {
    instrumentType: p.instrument_type ? String(p.instrument_type).toUpperCase() : null,
    optionStrategy: p.option_strategy ?? null,
    equityQty: accionesDePosicion(p, qty),
    legs: (Array.isArray(p.legs) ? p.legs : []).map(pata => ({
      instrumentType: pata.instrument_type ? String(pata.instrument_type).toUpperCase() : null,
      symbol: pata.symbol ?? null,
      optionType: pata.option_type ?? null,
      strikePrice: numeroReportado(pata.option_exercise_price),
      expirationDate: pata.option_expire_date ?? null,
      deliverable: numeroReportado(pata.option_contract_deliverable),
      lastPrice: numeroReportado(pata.last_price),
    })),
  };
}

export const getWebullPositions = async () => {
  const respuesta = exigirPuente('Webull', runBridge('positions'));
  if (!Array.isArray(respuesta.positions)) throw boom.badGateway('Webull devolvió posiciones ilegibles.');
  return respuesta.positions.map((p) => {
    const qty = numeroReportado(p.quantity);
    const { legs, ...contrato } = contratoDePosicionWebull(p);
    return {
      broker: 'WEBULL',
      assetId: p.position_id ?? null,
      symbol: p.symbol ?? null,
      instrumentType: contrato.instrumentType,
      optionStrategy: contrato.optionStrategy,
      qty,
      equityQty: contrato.equityQty,
      side: qty === null ? null : qty >= 0 ? 'long' : 'short',
      avgEntryPrice: numeroReportado(p.cost_price),
      currentPrice: numeroReportado(p.last_price),
      marketValue: numeroReportado(p.market_value),
      costBasis: numeroReportado(p.cost),
      unrealizedPL: numeroReportado(p.unrealized_profit_loss),
      unrealizedPLPercent: numeroReportado(p.unrealized_profit_loss_rate),
      legs,
      source: 'Webull OpenAPI',
    };
  });
};

export const getWebullOrders = async (status = 'all') => {
  const respuesta = exigirPuente('Webull', runBridge('orders'));
  if (!Array.isArray(respuesta.orders)) throw boom.badGateway('Webull devolvió órdenes ilegibles.');
  const ordenes = respuesta.orders.map((o) => {
    const patas = Array.isArray(o.legs) ? o.legs : [];
    const esOpcion = o.instrument_type === 'OPTION' || patas.length > 0;
    const primeraPata = esOpcion ? patas[0] ?? null : null;
    const id = o.order_id ?? o.combo_order_id ?? o.client_order_id ?? o.id;
    return {
      broker: 'WEBULL',
      id: id === undefined || id === null ? null : String(id),
      clientOrderId: o.client_order_id ?? o.parent_client_order_id ?? null,
      symbol: o.symbol ?? primeraPata?.symbol ?? null,
      instrumentType: esOpcion ? 'OPTION' : 'EQUITY',
      optionType: primeraPata?.option_type ?? null,
      strikePrice: numeroReportado(primeraPata?.strike_price),
      expirationDate: primeraPata?.option_expire_date ?? null,
      qty: numeroReportado(o.quantity ?? o.total_quantity ?? o.totalQuantity),
      side: o.side || o.action ? String(o.side || o.action).toLowerCase() : null,
      type: o.order_type || o.type ? String(o.order_type || o.type).toLowerCase() : null,
      timeInForce: o.time_in_force ? String(o.time_in_force).toLowerCase() : null,
      limitPrice: numeroReportado(o.limit_price),
      filledQty: numeroReportado(o.filled_quantity),
      status: o.status ? String(o.status).toLowerCase() : null,
      assetClass: esOpcion ? 'us_option' : 'us_stock',
      legs: o.legs ?? null,
      fees: o.fees ?? null,
      createdAt: o.place_time_at ?? o.create_time ?? null,
      source: 'Webull OpenAPI',
    };
  });
  return status && status !== 'all' ? ordenes.filter(orden => orden.status === String(status).toLowerCase()) : ordenes;
};

/**
 * Emisión a Webull de una orden ya validada por broker.service (sin precios, strikes ni vencimientos supuestos).
 */
export const createWebullOrder = async (orden) => {
  const comunes = ['--qty', String(orden.qty), '--action', orden.side.toUpperCase(), '--type', orden.type.toUpperCase()];
  if (orden.type === 'limit') comunes.push('--price', String(orden.limitPrice));
  comunes.push('--time_in_force', orden.timeInForce.toUpperCase());

  const resultado = orden.instrumentType === 'OPTION'
    ? runBridge('place_option', [
      '--symbol', orden.symbol,
      '--strike_price', String(orden.option.strike),
      '--option_type', orden.option.optionType,
      '--expire_date', orden.option.expiration,
      '--strategy', orden.strategy,
      ...(orden.strategy === 'COVERED_STOCK' ? ['--stock_price', String(orden.stockPrice)] : []),
      ...comunes,
    ])
    : runBridge('place_order', ['--symbol', orden.symbol, ...comunes]);

  const aceptada = exigirPuente('Webull', resultado, { rechazoComo400: true });
  const id = aceptada.result?.order_id ?? aceptada.result?.combo_order_id;
  if (!id) throw boom.badGateway('Webull respondió sin identificador de orden.');
  return {
    id: String(id),
    clientOrderId: aceptada.result?.client_order_id ?? aceptada.clientOrderId ?? null,
    status: aceptada.result?.status ?? null,
    filledQty: numeroReportado(aceptada.result?.filled_quantity),
    createdAt: null,
    source: 'Webull OpenAPI',
    details: aceptada.result ?? null,
  };
};

/**
 * Cancelación en Webull: éxito solo si el broker la confirma.
 */
export const cancelWebullOrder = async (orderId) => {
  exigirPuente('Webull', runBridge('cancel_order', ['--order_id', orderId]), { rechazoComo400: true });
  return { message: `Webull confirmó la cancelación de la orden ${orderId}.` };
};

export default {
  getWebullAccount,
  getWebullQuote,
  getWebullPositions,
  getWebullOrders,
  createWebullOrder,
  cancelWebullOrder,
};
