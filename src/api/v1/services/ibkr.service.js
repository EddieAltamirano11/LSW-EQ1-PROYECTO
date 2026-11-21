import boom from '@hapi/boom';
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import config from '../../../config/config.js';
import { assertBrokerAndDatabasesReadiness, checkIBKRTunnel } from './preflight.service.js';
import { exigirPuente, numeroReportado } from './brokerRespuestas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRIDGE_SCRIPT = path.join(__dirname, '../../../../scripts/ibkr_desktop_bridge.py');

/**
 * Ejecuta un comando en el bridge Python oficial de Interactive Brokers TWS
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
        IBKR_TWS_HOST: config.IBKR_TWS_HOST || '147.182.206.211',
        IBKR_TWS_PORT: String(config.IBKR_TWS_PORT || 7496),
        IBKR_ACCOUNT_ID: config.IBKR_ACCOUNT_ID || 'DUR303142',
        IBKR_CLIENT_ID: String(config.IBKR_CLIENT_ID || 25),
      },
    });
    if (result.error) {
      console.warn(`[IBKR Desktop Bridge Spawn Error] (${command}): ${result.error.message}`);
    }
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
    console.warn(`[IBKR Desktop Bridge Error] (${command}): ${e.message}`);
  }
  return null;
};

async function causaSinSocket() {
  const tunel = await checkIBKRTunnel(2000);
  return `el socket TCP hacia Trader Workstation (TWS) en ${tunel.host}:${tunel.port} no está disponible (${tunel.error || tunel.code || 'desconectado'})`;
}

/**
 * Cuenta de IBKR: solo los saldos que reporta TWS; los que falten quedan en null.
 */
export const getIBKRAccount = async () => {
  const cuenta = runBridge('account');
  if (!cuenta?.success || cuenta.mode !== 'LIVE_TWS_SOCKET') {
    if (cuenta && !cuenta.success && cuenta.status === 502) exigirPuente('Interactive Brokers', cuenta);
    throw boom.serverUnavailable(`No se puede consultar la cuenta de Interactive Brokers: ${await causaSinSocket()}.`);
  }
  return {
    broker: 'IBKR',
    accountId: cuenta.accountNumber ?? null,
    status: null,
    currency: cuenta.currency ?? null,
    cash: numeroReportado(cuenta.cash),
    portfolioValue: numeroReportado(cuenta.portfolioValue),
    buyingPower: numeroReportado(cuenta.buyingPower),
    unrealizedPL: numeroReportado(cuenta.unrealizedPL),
    realizedPL: numeroReportado(cuenta.realizedPL),
    tradingBlocked: null,
    transfersBlocked: null,
    accountBlocked: null,
    createdAt: null,
    source: cuenta.source || 'Interactive Brokers TWS Socket',
  };
};

/**
 * Cotización de IBKR: bid y ask solo si TWS los informa.
 */
export const getIBKRQuote = async (symbol) => {
  const ticker = symbol.toUpperCase();
  const cotizacion = exigirPuente('Interactive Brokers TWS', runBridge('quote', ['--symbol', ticker]));
  const ultimo = numeroReportado(cotizacion.price);
  if (!(ultimo > 0)) throw boom.badGateway(`Interactive Brokers no informó un precio para ${ticker}.`);
  const positivo = valor => (numeroReportado(valor) > 0 ? numeroReportado(valor) : null);
  return {
    broker: 'IBKR',
    symbol: ticker,
    companyName: cotizacion.companyName ?? null,
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
    source: 'Interactive Brokers TWS Market Data Feed',
  };
};

const TIPOS_IBKR = { STK: 'EQUITY', OPT: 'OPTION' };

/**
 * Posiciones de IBKR con su tipo de instrumento; el costo promedio no se usa como precio actual.
 */
export const getIBKRPositions = async () => {
  const respuesta = runBridge('positions');
  if (!respuesta?.success) throw boom.serverUnavailable(`No se pueden consultar las posiciones de Interactive Brokers: ${await causaSinSocket()}.`);
  if (!Array.isArray(respuesta.positions)) throw boom.badGateway('Interactive Brokers devolvió posiciones ilegibles.');
  return respuesta.positions.map((p) => {
    const qty = numeroReportado(p.quantity);
    const instrumentType = TIPOS_IBKR[p.secType] ?? (p.secType ? String(p.secType) : null);
    return {
      broker: 'IBKR',
      assetId: p.conId === undefined || p.conId === null ? null : String(p.conId),
      symbol: p.symbol ?? null,
      instrumentType,
      secType: p.secType ?? null,
      qty,
      equityQty: instrumentType === 'EQUITY' ? qty : instrumentType ? 0 : null,
      side: qty === null ? null : qty >= 0 ? 'long' : 'short',
      avgEntryPrice: numeroReportado(p.avgCost),
      currentPrice: numeroReportado(p.marketPrice),
      marketValue: numeroReportado(p.marketValue),
      costBasis: numeroReportado(p.costBasis),
      unrealizedPL: numeroReportado(p.unrealizedPNL),
      source: 'Interactive Brokers TWS Portfolio',
    };
  });
};

/**
 * Órdenes de IBKR tal como las reporta TWS.
 */
export const getIBKROrders = async (status = 'all') => {
  const respuesta = runBridge('orders');
  if (!respuesta?.success) throw boom.serverUnavailable(`No se pueden consultar las órdenes de Interactive Brokers: ${await causaSinSocket()}.`);
  if (!Array.isArray(respuesta.orders)) throw boom.badGateway('Interactive Brokers devolvió órdenes ilegibles.');
  const ordenes = respuesta.orders.map((ord) => ({
    broker: 'IBKR',
    id: ord.id ?? ord.permId ? String(ord.id ?? ord.permId) : null,
    clientOrderId: ord.permId ?? null,
    symbol: ord.symbol ?? null,
    assetClass: ord.secType === 'OPT' ? 'us_option' : ord.secType === 'STK' ? 'us_equity' : null,
    quantity: numeroReportado(ord.qty),
    filledQty: numeroReportado(ord.filled),
    side: ord.action ? String(ord.action).toLowerCase() : null,
    type: ord.orderType ? String(ord.orderType).toLowerCase() : null,
    limitPrice: numeroReportado(ord.limitPrice),
    status: ord.status ?? null,
    createdAt: null,
    source: 'Interactive Brokers TWS Live Socket',
  }));
  return status && status !== 'all' ? ordenes.filter(orden => String(orden.status).toLowerCase() === String(status).toLowerCase()) : ordenes;
};

/**
 * Emisión a IBKR de una orden ya validada por broker.service. Antes verifica el túnel TWS y las bases de datos.
 */
export const createIBKROrder = async (orden) => {
  await assertBrokerAndDatabasesReadiness({ dbTarget: orden.dbTarget || orden.database || 'supabase', broker: 'IBKR' });
  const argumentos = [
    '--symbol', orden.symbol,
    '--qty', String(orden.qty),
    '--action', orden.side.toUpperCase(),
    '--type', orden.type.toUpperCase(),
    '--instrument_type', orden.instrumentType,
  ];
  if (orden.type === 'limit') argumentos.push('--price', String(orden.limitPrice));
  if (orden.instrumentType === 'OPTION') {
    argumentos.push('--option_type', orden.option.optionType, '--strike_price', String(orden.option.strike), '--expire_date', orden.option.expiration);
  }
  const resultado = runBridge('place_order', argumentos);
  if (!resultado) throw boom.serverUnavailable('Interactive Brokers TWS no respondió a la orden.');
  // TWS recibió la orden y la canceló o rechazó (por ejemplo, una orden a mercado con la sesión cerrada): es un rechazo, no una caída.
  if (resultado.mode === 'ORDER_REJECTED') {
    throw boom.badRequest(`Interactive Brokers rechazó la orden (${resultado.status ?? 'sin estado'}): ${resultado.error || 'sin detalle'}`);
  }
  if (!resultado.success || resultado.mode !== 'LIVE_TWS_ORDER') {
    throw boom.serverUnavailable(resultado.error || 'No fue posible emitir la orden en Interactive Brokers TWS.');
  }
  const estado = resultado.status ? String(resultado.status).toLowerCase() : null;
  if (['cancelled', 'canceled', 'rejected', 'inactive'].includes(estado)) {
    throw boom.badRequest(`Interactive Brokers rechazó la orden (${resultado.status}): ${resultado.error || 'sin detalle'}`);
  }
  const id = resultado.orderId ?? resultado.permId;
  if (id === undefined || id === null) throw boom.badGateway('Interactive Brokers respondió sin identificador de orden.');
  return {
    id: String(id),
    clientOrderId: resultado.clientOrderId ?? null,
    status: resultado.status ?? null,
    filledQty: numeroReportado(resultado.filled),
    createdAt: null,
    source: 'Interactive Brokers TWS Live Socket',
    details: resultado,
  };
};

/**
 * Cancelación en IBKR: confirmada cuando TWS informa Cancelled; en curso (pending) cuando TWS informa PendingCancel.
 */
export const cancelIBKROrder = async (orderId) => {
  const resultado = exigirPuente('Interactive Brokers TWS', runBridge('cancel_order', ['--order_id', orderId]), { rechazoComo400: true });
  if (resultado?.pending) {
    return {
      message: `Interactive Brokers recibió la cancelación de la orden ${orderId}; TWS aún no la confirma (estado ${resultado.status}).`,
      status: resultado.status,
      pending: true,
    };
  }
  return { message: `Interactive Brokers confirmó la cancelación de la orden ${orderId}.`, status: resultado?.status ?? null };
};

export default {
  getIBKRAccount,
  getIBKRQuote,
  getIBKRPositions,
  getIBKROrders,
  createIBKROrder,
  cancelIBKROrder,
};
