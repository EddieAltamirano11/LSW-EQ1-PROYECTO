import boom from '@hapi/boom';
import { getHedgingRepo } from '../repositories/hedging.repository.js';
import { getUnderlyingRepo } from '../repositories/underlying.repository.js';
import { calculateBlackScholes } from './quant.service.js';
import { getBrokerQuote, getBrokerOptionsChain, createBrokerOrder, getBrokerOrders, getBrokerAccount } from './broker.service.js';
import { randomUUID } from 'crypto';
import config from '../../../config/config.js';
import { assertBrokerAndDatabasesReadiness } from './preflight.service.js';
import { coberturas } from './coberturas.service.js';
import { time } from './observaciones.js';
import { contratoLiquido, contratoPublico, elegirCollar, horizonteHasta, obtenerCadenaCobertura, spreadRelativo } from './cadenaOpciones.service.js';

export const formatOccSymbol = (symbol, expirationDate, type, strike) => {
  const sym = String(symbol || '').toUpperCase().trim();
  const d = expirationDate ? new Date(expirationDate) : new Date(Date.now() + 30 * 86400000);
  const validD = isNaN(d.getTime()) ? new Date(Date.now() + 30 * 86400000) : d;
  const yy = String(validD.getUTCFullYear()).slice(-2);
  const mm = String(validD.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(validD.getUTCDate()).padStart(2, '0');
  const t = String(type || 'C').toUpperCase().charAt(0);
  const strikeNum = Math.round(Number(strike || 0) * 1000);
  const strikeStr = String(strikeNum).padStart(8, '0');
  return `${sym}${yy}${mm}${dd}${t}${strikeStr}`;
};

/**
 * Validador estricto de fecha de expiración para derivados bursátiles
 * Impide negociar, cotizar o estructurar opciones con fechas pasadas o vencidas
 */
export const validateFutureExpirationDate = (expirationDate) => {
  if (!expirationDate) {
    throw boom.badRequest('La fecha de expiración (expirationDate) es obligatoria para negociar opciones.');
  }
  const cleanDate = String(expirationDate).split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length !== 3) {
    throw boom.badRequest(`La fecha de expiración '${expirationDate}' tiene formato inválido. Use formato YYYY-MM-DD.`);
  }
  const expYear = parseInt(parts[0], 10);
  const expMonth = parseInt(parts[1], 10) - 1;
  const expDay = parseInt(parts[2], 10);
  let expDateObj = new Date(Date.UTC(expYear, expMonth, expDay));

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (isNaN(expDateObj.getTime()) || expDateObj <= today) {
    throw boom.badRequest(
      `La fecha de expiración '${cleanDate}' es inválida porque ya ha vencido o vence hoy. ` +
      `Las opciones financieras requieren una fecha futura de vencimiento para poder cotizarse y emitirse en el broker.`
    );
  }

  // Alineación estricta al primer viernes hábil (las opciones en Wall Street vencen en viernes)
  const dayOfWeek = expDateObj.getUTCDay(); // 0=Dom, 1=Lun, ..., 5=Vie, 6=Sáb
  if (dayOfWeek !== 5) {
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    expDateObj = new Date(expDateObj.getTime() + daysUntilFriday * 86400000);
  }

  // Salvaguarda de feriados bursátiles CBOE/NYSE (Navidad / Año Nuevo)
  if (expDateObj.getUTCMonth() === 11 && expDateObj.getUTCDate() === 25) {
    expDateObj = new Date(Date.UTC(expDateObj.getUTCFullYear(), 11, 18));
  } else if (expDateObj.getUTCMonth() === 0 && expDateObj.getUTCDate() === 1) {
    expDateObj = new Date(Date.UTC(expDateObj.getUTCFullYear() - 1, 11, 31));
  }

  const yyyy = expDateObj.getUTCFullYear();
  const mm = String(expDateObj.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(expDateObj.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const calculateTimeToExpirationYears = (expirationDate) => {
  if (!expirationDate) return 0.1;
  const cleanDate = String(expirationDate).split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length === 3) {
    const expYear = parseInt(parts[0], 10);
    const expMonth = parseInt(parts[1], 10) - 1;
    const expDay = parseInt(parts[2], 10);
    const d = new Date(expYear, expMonth, expDay);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 0) {
      throw boom.badRequest(
        `La fecha de expiración '${cleanDate}' ya ha vencido. Las opciones financieras requieren una fecha futura de vencimiento.`
      );
    }
    return Number((diffDays / 365).toFixed(4));
  }
  const d = new Date(expirationDate);
  if (isNaN(d.getTime())) return 0.1;
  const now = new Date();
  const diffDays = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 0) {
    throw boom.badRequest(
      `La fecha de expiración '${expirationDate}' ya ha vencido. Las opciones financieras requieren una fecha futura de vencimiento.`
    );
  }
  return Number((diffDays / 365).toFixed(4));
};

export const listStrategies = async (filter = {}, dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  return await repo.getAll(filter);
};

export const getStrategyById = async (id, dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  const strategy = await repo.getById(id);
  if (!strategy) {
    throw boom.notFound(`No se encontró la estrategia de cobertura con ID '${id}' en ${dbTarget.toUpperCase()}.`);
  }
  return strategy;
};

// ESTRUCTURACIÓN Y CREACIÓN DE PROTECTIVE PUT (F2 PARTE B)
const debeEjecutar = payload => payload.executeOrders === true || payload.executeOrders === 'true' || payload.executeOnBroker === true;

// Precio del subyacente para un registro manual: el del payload o la cotización del broker; nunca el guardado en la base.
async function precioParaRegistro(payload, broker) {
  const indicado = Number(payload.spotPrice);
  if (indicado > 0) return indicado;
  const cotizacion = await getBrokerQuote(payload.symbol, broker);
  if (!(cotizacion?.lastPrice > 0)) throw boom.serverUnavailable(`${broker} no informó el precio de ${payload.symbol}; indica spotPrice.`);
  return cotizacion.lastPrice;
}

function primaObligatoria(valor, nombre) {
  const prima = Number(valor);
  if (valor === undefined || valor === null || valor === '' || !(prima >= 0)) {
    throw boom.badRequest(`${nombre} es obligatorio y debe ser un número mayor o igual a 0; no se asignan primas predeterminadas.`);
  }
  return prima;
}

function cantidadDeAcciones(payload) {
  const cantidad = Number(payload.sharesCount ?? payload.sharesQuantity ?? 100);
  if (!Number.isInteger(cantidad) || cantidad <= 0) throw boom.badRequest('La cantidad de acciones (sharesCount) debe ser un entero mayor a 0.');
  return cantidad;
}

// PROTECTIVE PUT: con executeOrders emite las patas con precios observados (coberturas.service); sin él registra lo indicado.
export const createProtectivePut = async (payload, dbTarget = 'mongodb') => {
  const targetBroker = (payload.broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();
  if (!payload.symbol) throw boom.badRequest('symbol es obligatorio.');
  if (debeEjecutar(payload)) {
    await assertBrokerAndDatabasesReadiness({ dbTarget, broker: targetBroker });
    return coberturas.protectivePut({ ...payload, broker: targetBroker }, dbTarget);
  }
  if (targetBroker === 'IBKR') await assertBrokerAndDatabasesReadiness({ dbTarget, broker: 'IBKR' });

  const ticker = String(payload.symbol).toUpperCase();
  const vencimiento = validateFutureExpirationDate(payload.expirationDate);
  const count = cantidadDeAcciones(payload);
  const K = Number(payload.putStrike);
  if (!(K > 0)) throw boom.badRequest('putStrike es obligatorio.');
  const premium = primaObligatoria(payload.putPremium, 'putPremium');
  const S = await precioParaRegistro({ ...payload, symbol: ticker }, targetBroker);
  const contracts = Math.ceil(count / 100);

  const strategyDoc = {
    id: `STRAT-PP-${ticker}-${randomUUID().slice(0, 4)}`,
    portfolioId: payload.portfolioId || 'PORT-01',
    broker: targetBroker,
    strategyType: 'PROTECTIVE_PUT',
    status: 'ACTIVE',
    underlying: { symbol: ticker, companyName: payload.companyName || ticker, spotPriceAtEntry: S, sharesCount: count },
    legs: [
      { legId: `LEG-${ticker}-UNDERLYING`, legRole: 'UNDERLYING', assetType: 'EQUITY', contractSymbol: null, quantity: count, entryPrice: S },
      {
        legId: `LEG-${ticker}-HEDGE_FLOOR`, legRole: 'HEDGE_FLOOR', assetType: 'OPTION',
        contractSymbol: formatOccSymbol(ticker, `${vencimiento}T00:00:00.000Z`, 'P', K),
        optionType: 'PUT', strike: K, expirationDate: new Date(`${vencimiento}T00:00:00.000Z`), quantity: contracts, entryPrice: premium,
      },
    ],
    financialMetrics: {
      netDebitCredit: Number((-premium * count).toFixed(2)),
      breakevenPrice: Number((S + premium).toFixed(2)),
      floorProtectionPrice: K,
      maxLossTotalUSD: Number(((S - K + premium) * count).toFixed(2)),
    },
  };
  return getHedgingRepo(dbTarget).create(strategyDoc);
};

// COLLAR MANUAL (registro): exige primas explícitas de ambas patas y usa el vencimiento real en el símbolo OCC.
export const createCollarSpread = async (payload, dbTarget = 'mongodb') => {
  const targetBroker = (payload.broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();
  if (!payload.symbol) throw boom.badRequest('symbol es obligatorio.');
  const ticker = String(payload.symbol).toUpperCase();
  const p_put = primaObligatoria(payload.putPremium, 'putPremium');
  const p_call = primaObligatoria(payload.callPremium, 'callPremium');
  const vencimiento = validateFutureExpirationDate(payload.expirationDate);
  const count = cantidadDeAcciones(payload);
  const K_put = Number(payload.putStrike);
  const K_call = Number(payload.callStrike);
  if (!(K_put > 0) || !(K_call > 0)) throw boom.badRequest('putStrike y callStrike son obligatorios.');
  if (targetBroker === 'IBKR') await assertBrokerAndDatabasesReadiness({ dbTarget, broker: 'IBKR' });
  const S = await precioParaRegistro({ ...payload, symbol: ticker }, targetBroker);
  if (K_put >= S) throw boom.badRequest('El Strike del Put protector debe ser inferior al precio Spot (Out-of-the-Money).');
  if (K_call <= S) throw boom.badRequest('El Strike del Call financiador debe ser superior al precio Spot (Out-of-the-Money).');
  const contracts = Math.ceil(count / 100);
  const netCreditPerShare = p_call - p_put;
  const fechaVencimiento = new Date(`${vencimiento}T00:00:00.000Z`);

  const strategyDoc = {
    id: `STRAT-COLLAR-${ticker}-${randomUUID().slice(0, 4)}`,
    portfolioId: payload.portfolioId || 'PORT-01',
    broker: targetBroker,
    strategyType: 'COLLAR',
    status: 'ACTIVE',
    underlying: { symbol: ticker, companyName: payload.companyName || ticker, spotPriceAtEntry: S, sharesCount: count },
    legs: [
      { legId: `LEG-${ticker}-UNDERLYING`, legRole: 'UNDERLYING', assetType: 'EQUITY', contractSymbol: null, brokerOrderId: payload.stockOrderId || null, quantity: count, entryPrice: S },
      {
        legId: `LEG-${ticker}-HEDGE_FLOOR`, legRole: 'HEDGE_FLOOR', assetType: 'OPTION', contractSymbol: formatOccSymbol(ticker, fechaVencimiento.toISOString(), 'P', K_put),
        brokerOrderId: payload.putOrderId || null, optionType: 'PUT', strike: K_put, expirationDate: fechaVencimiento, quantity: contracts, entryPrice: p_put,
      },
      {
        legId: `LEG-${ticker}-FINANCE_CEILING`, legRole: 'FINANCE_CEILING', assetType: 'OPTION', contractSymbol: formatOccSymbol(ticker, fechaVencimiento.toISOString(), 'C', K_call),
        brokerOrderId: payload.callOrderId || null, optionType: 'CALL', strike: K_call, expirationDate: fechaVencimiento, quantity: contracts, entryPrice: p_call,
      },
    ],
    financialMetrics: {
      netDebitCredit: Number((netCreditPerShare * count).toFixed(2)),
      breakevenPrice: Number((S - netCreditPerShare).toFixed(2)),
      floorProtectionPrice: K_put,
      maxLossTotalUSD: Number(((S - K_put - netCreditPerShare) * count).toFixed(2)),
      maxProfitTotalUSD: Number(((K_call - S + netCreditPerShare) * count).toFixed(2)),
    },
  };
  return getHedgingRepo(dbTarget).create(strategyDoc);
};

// ============================================================================
// CALIBRACIÓN Y RECOMENDACIÓN AUTOMÁTICA DE ZERO-COST COLLAR CON MOTOR F0
// ============================================================================
// Vista previa del collar con la misma regla del Core 004 sobre la cadena real: contratos, cotizaciones y métricas.
export function vistaPreviaCollar(ticker, spot, put, call) {
  const acciones = put.multiplier;
  const costoNeto = put.ask - call.bid;
  const base = spot.price + costoNeto;
  const redondear = valor => Number(valor.toFixed(2));
  const pata = opcion => ({ ...contratoPublico(opcion), spreadPct: redondear(spreadRelativo(opcion) * 100) });
  return {
    symbol: ticker,
    underlying: { price: spot.price, quoteTime: Number.isFinite(spot.at) ? new Date(spot.at).toISOString() : null, source: 'Alpaca Market Data IEX (cierre de 1 minuto)' },
    put: pata(put),
    call: pata(call),
    metrics: {
      shares: acciones,
      netPremiumPerShare: redondear(costoNeto),
      netCost: costoNeto > 0 ? 'DEBIT' : costoNeto < 0 ? 'CREDIT' : 'ZERO',
      maxLoss: redondear((base - put.strike) * acciones),
      maxProfit: redondear((call.strike - base) * acciones),
      breakEven: redondear(base),
    },
    rule: 'Selección del Core 004: Put y Call OTM líquidos del mismo vencimiento, cercanos al 95 % y 105 % del precio, con el Put al ask y el Call al bid.',
  };
}

export const autoCalibrateAndCreateCollar = async (params, dbTarget = 'mongodb') => {
  const {
    symbol,
    sharesCount = 10,
    portfolioId = 'PORT-01',
    expirationDate,
    autoPersist = true,
    broker = config.DEFAULT_BROKER || 'WEBULL',
    executeOrders = true,
    buyUnderlying = true,
    ahora,
  } = params;

  if (!symbol) {
    throw boom.badRequest('El símbolo del activo (symbol) es requerido para la calibración automática.');
  }

  const ticker = symbol.toUpperCase();
  const targetBroker = (broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();
  const shouldExecute = autoPersist && (executeOrders === true || executeOrders === 'true' || params.executeOnBroker === true);

  // Ejecución: Put primero, precios observados al ejecutar y compensación de patas (coberturas.service).
  if (shouldExecute) {
    await assertBrokerAndDatabasesReadiness({ dbTarget, broker: targetBroker });
    return coberturas.autoCollar({ ...params, symbol: ticker, broker: targetBroker }, dbTarget);
  }

  // 1. Cadena real (contratos listados + cotizaciones observadas) y selección del Core 004, la misma del ranking.
  const { spot, cadena } = await obtenerCadenaCobertura(ticker, { horizonteDias: horizonteHasta(expirationDate, ahora), ahora });
  const par = elegirCollar(spot, cadena);
  if (!par) {
    throw boom.badRequest(`No hay un Put y un Call de ${ticker} con liquidez y costo base verificables en la cadena real; no se arma el collar.`);
  }
  const spotPrice = spot.price;
  const cleanExpDate = par.put.expiration;
  const optimalPut = { contractSymbol: par.put.symbol, strike: par.put.strike, premium: par.put.ask };
  const optimalCall = { contractSymbol: par.call.symbol, strike: par.call.strike, premium: par.call.bid };
  const preview = vistaPreviaCollar(ticker, spot, par.put, par.call);
  const analysisReport = {
    symbol: ticker,
    spotPrice,
    selectionCriteria: { rule: preview.rule, netCost: preview.metrics.netCost, netPremiumPerShare: preview.metrics.netPremiumPerShare },
    optimalContracts: {
      put: { contractSymbol: optimalPut.contractSymbol, strike: optimalPut.strike, marketPremium: optimalPut.premium, role: 'HEDGE_FLOOR (Póliza de Seguro Protector)' },
      call: { contractSymbol: optimalCall.contractSymbol, strike: optimalCall.strike, marketPremium: optimalCall.premium, role: 'FINANCE_CEILING (Financiamiento del collar)' },
    },
  };

  return {
    message: `Vista previa del collar de ${ticker} con la selección del Core 004 sobre cotizaciones observadas. No se emitieron órdenes ni se guardó la estrategia.`,
    preview,
    analysis: analysisReport,
    strategy: null,
    brokerExecution: { broker: targetBroker, executed: false, note: 'Vista previa: envía executeOrders: true para emitir las órdenes.' },
  };
};

export const createStrategiesBatch = async (items, dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  return await repo.createBatch(items);
};

export const updateStrategy = async (id, updates, dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  const updated = await repo.update(id, updates);
  if (!updated) throw boom.notFound(`Estrategia '${id}' no encontrada.`);
  return updated;
};

export const updateStrategyStatus = async (id, status, dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  const updated = await repo.update(id, { status });
  if (!updated) throw boom.notFound(`Estrategia '${id}' no encontrada.`);
  return updated;
};

export const deleteStrategy = async (id, dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  const deleted = await repo.delete(id);
  if (!deleted) throw boom.notFound(`Estrategia '${id}' no encontrada.`);
  return deleted;
};

// === SUBDOCUMENTOS: UNDERLYING ===
export const getUnderlyingSub = async (strategyId, dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  const data = await repo.getUnderlyingSubdocument(strategyId);
  if (!data) throw boom.notFound(`Subdocumento subyacente no encontrado para estrategia '${strategyId}'.`);
  return data;
};

export const updateUnderlyingSub = async (strategyId, updates, dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  const updated = await repo.updateUnderlyingSubdocument(strategyId, updates);
  if (!updated) throw boom.notFound(`No se pudo actualizar el subyacente de la estrategia '${strategyId}'.`);
  return updated;
};

// === SUBDOCUMENTOS: LEGS (CRUD COMPLETO INDIVIDUAL Y ARREGLO) ===
export const getLegsList = async (strategyId, dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  const legs = await repo.getAllLegs(strategyId);
  if (!legs) throw boom.notFound(`Estrategia '${strategyId}' no encontrada.`);
  return legs;
};

export const getLegById = async (strategyId, legId, dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  const leg = await repo.getLegById(strategyId, legId);
  if (!leg) throw boom.notFound(`Pata '${legId}' no encontrada en la estrategia '${strategyId}'.`);
  return leg;
};

export const addSingleLeg = async (strategyId, legData, dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  const leg = await repo.addLeg(strategyId, legData);
  if (!leg) throw boom.notFound(`Estrategia '${strategyId}' no encontrada para agregar pata.`);
  return leg;
};

// Los lotes de patas exigen un arreglo no vacío; un cuerpo con otra forma es una petición inválida (400), no un error interno.
function exigirArreglo(valor, descripcion) {
  if (!Array.isArray(valor) || !valor.length) throw boom.badRequest(`Se espera ${descripcion}.`);
  return valor;
}

export const addLegsBatch = async (strategyId, legsArray, dbTarget = 'mongodb') => {
  exigirArreglo(legsArray, 'un arreglo no vacío de patas');
  if (legsArray.some(pata => !pata || typeof pata !== 'object')) throw boom.badRequest('Cada pata del lote debe ser un objeto.');
  const repo = getHedgingRepo(dbTarget);
  const result = await repo.addLegsBatch(strategyId, legsArray);
  if (!result) throw boom.notFound(`Estrategia '${strategyId}' no encontrada.`);
  return result;
};

export const updateSingleLeg = async (strategyId, legId, updates, dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  const leg = await repo.updateLeg(strategyId, legId, updates);
  if (!leg) throw boom.notFound(`Pata '${legId}' no encontrada en '${strategyId}'.`);
  return leg;
};

export const updateLegsBatch = async (strategyId, updatesArray, dbTarget = 'mongodb') => {
  exigirArreglo(updatesArray, 'un arreglo no vacío de cambios de patas');
  if (updatesArray.some(cambio => typeof cambio?.legId !== 'string' || !cambio.legId)) {
    throw boom.badRequest('Cada cambio del lote debe indicar el legId de la pata.');
  }
  const repo = getHedgingRepo(dbTarget);
  const result = await repo.updateLegsBatch(strategyId, updatesArray);
  if (!result) throw boom.notFound(`Estrategia '${strategyId}' no encontrada.`);
  return result;
};

export const updateLegRatio = async (strategyId, legId, ratioData, dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  const updates = {};
  if (ratioData.ratio !== undefined) updates.ratio = Number(ratioData.ratio);
  if (ratioData.quantity !== undefined) updates.quantity = Number(ratioData.quantity);
  const leg = await repo.updateLeg(strategyId, legId, updates);
  if (!leg) throw boom.notFound(`Pata '${legId}' no encontrada en la estrategia '${strategyId}'.`);
  return leg;
};

export const reorderLegs = async (strategyId, orderedLegIds = [], dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  const currentLegs = await repo.getAllLegs(strategyId);
  if (!currentLegs) throw boom.notFound(`Estrategia '${strategyId}' no encontrada.`);

  const legMap = new Map(currentLegs.map((l) => [l.legId, l]));
  const reordered = [];
  for (const id of orderedLegIds) {
    if (legMap.has(id)) {
      reordered.push(legMap.get(id));
      legMap.delete(id);
    }
  }
  for (const remaining of legMap.values()) {
    reordered.push(remaining);
  }

  await repo.update(strategyId, { legs: reordered });
  return reordered;
};

export const deleteSingleLeg = async (strategyId, legId, dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  const result = await repo.deleteLeg(strategyId, legId);
  if (!result) throw boom.notFound(`Pata '${legId}' no encontrada en '${strategyId}'.`);
  return result;
};

export const deleteLegsBatch = async (strategyId, legIdsArray, dbTarget = 'mongodb') => {
  exigirArreglo(legIdsArray, 'legIds: un arreglo no vacío de identificadores de patas');
  if (legIdsArray.some(legId => typeof legId !== 'string' || !legId)) throw boom.badRequest('Cada legId debe ser un texto no vacío.');
  const repo = getHedgingRepo(dbTarget);
  const result = await repo.deleteLegsBatch(strategyId, legIdsArray);
  if (!result) throw boom.notFound(`Estrategia '${strategyId}' no encontrada.`);
  return result;
};

// ============================================================================
// RECOMENDACIÓN CUANTITATIVA DE OPCIÓN INDIVIDUAL (PUT o CALL) CON MOTOR F0
// ============================================================================
export const recommendOption = async (params) => {
  const {
    symbol,
    type,
    optionType,
    expirationDate,
    broker = config.DEFAULT_BROKER || 'WEBULL',
    moneyness = 'OTM',
    ahora,
  } = params;

  if (!symbol) {
    throw boom.badRequest('El símbolo del activo (symbol) es requerido.');
  }
  const optType = String(type || optionType || 'PUT').toUpperCase();
  if (!['PUT', 'CALL'].includes(optType)) {
    throw boom.badRequest("El parámetro type debe ser 'PUT' o 'CALL'.");
  }
  const preferencia = String(moneyness).toUpperCase();
  if (!['OTM', 'ATM', 'ITM'].includes(preferencia)) {
    throw boom.badRequest("El parámetro moneyness debe ser 'OTM', 'ATM' o 'ITM'.");
  }

  const ticker = symbol.toUpperCase();
  const targetBroker = (broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();

  // Contratos listados y líquidos (regla del Core 004) del tipo pedido, con sus cotizaciones observadas.
  const { spot, cadena } = await obtenerCadenaCobertura(ticker, { horizonteDias: horizonteHasta(expirationDate, ahora), ahora });
  const tipoCadena = optType === 'PUT' ? 'put' : 'call';
  const precio = spot.price;
  const delTipo = cadena.contracts.filter(c => c.type === tipoCadena && contratoLiquido(c)
    && (!expirationDate || c.expiration === String(expirationDate).slice(0, 10)));
  const esOtm = c => (optType === 'PUT' ? c.strike < precio : c.strike > precio);
  const enRango = { OTM: esOtm, ITM: c => !esOtm(c) && c.strike !== precio, ATM: () => true }[preferencia];
  // Objetivo: 95 % del precio para un Put OTM y 105 % para un Call OTM, como el Core 004; el precio mismo para ATM.
  const factor = { OTM: optType === 'PUT' ? 0.95 : 1.05, ITM: optType === 'PUT' ? 1.05 : 0.95, ATM: 1 }[preferencia];
  const objetivo = precio * factor;
  const candidatos = delTipo.filter(enRango).sort((a, b) => Math.abs(time(a.expiration) - cadena.target) - Math.abs(time(b.expiration) - cadena.target)
    || Math.abs(a.strike - objetivo) - Math.abs(b.strike - objetivo) || a.symbol.localeCompare(b.symbol));
  if (!candidatos.length) {
    throw boom.serverUnavailable(`No hay contratos ${optType} ${preferencia} líquidos y cotizados de ${ticker}${expirationDate ? ` con vencimiento ${expirationDate}` : ''}.`);
  }

  const describir = opcion => {
    const distancia = Math.abs(opcion.strike - precio) / precio;
    return {
      ...contratoPublico(opcion),
      spreadPct: Number((spreadRelativo(opcion) * 100).toFixed(2)),
      moneyness: distancia <= 0.03 ? 'ATM' : `${(distancia * 100).toFixed(1)}% ${esOtm(opcion) ? 'OTM' : 'ITM'}`,
    };
  };
  const mejor = describir(candidatos[0]);
  return {
    message: `Contrato ${optType} recomendado para ${ticker} a partir de la cadena real; no se emitió ninguna orden.`,
    broker: targetBroker,
    symbol: ticker,
    spotPrice: precio,
    spotTime: Number.isFinite(spot.at) ? new Date(spot.at).toISOString() : null,
    optionType: optType,
    expirationDate: mejor.expirationDate,
    moneynessPreference: preferencia,
    recommendedContract: {
      ...mejor,
      role: optType === 'PUT' ? 'HEDGE_FLOOR (Póliza de Seguro Protector contra caídas)' : 'FINANCE_CEILING (Techo de Ganancia y Financiamiento de Cobertura)',
      justification: optType === 'PUT'
        ? `Put listado con strike $${mejor.strike} (${mejor.moneyness}); su ask observado es $${mejor.ask} por acción.`
        : `Call listado con strike $${mejor.strike} (${mejor.moneyness}); su bid observado es $${mejor.bid} por acción.`,
    },
    availableContractsCount: delTipo.length,
    topCandidates: candidatos.slice(0, 3).map(describir),
  };
};

// === SUBDOCUMENTOS: FINANCIAL METRICS & PAYOFF ===
export const getStrategyMetrics = async (strategyId, dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  const metrics = await repo.getMetrics(strategyId);
  if (!metrics) throw boom.notFound(`Métricas no encontradas para la estrategia '${strategyId}'.`);
  return metrics;
};

export const recalculateMetrics = async (strategyId, { currentSpotPrice } = {}, dbTarget = 'mongodb') => {
  const strategy = await getStrategyById(strategyId, dbTarget);
  const spot = currentSpotPrice ? Number(currentSpotPrice) : strategy.underlying.spotPriceAtEntry;
  const legs = strategy.legs || [];

  let netDebitCredit = 0;
  let netDelta = 0;
  let floor = null;

  for (const leg of legs) {
    if (leg.legRole === 'UNDERLYING') {
      netDelta += (leg.delta || 1.0);
    } else if (leg.legRole === 'HEDGE_FLOOR' || leg.role === 'LONG_PUT') {
      floor = leg.strike;
      netDelta += (leg.delta || -0.32);
      netDebitCredit -= (leg.entryPrice || leg.premium || 0) * (strategy.underlying.sharesCount || 100);
    } else if (leg.legRole === 'FINANCE_CEILING' || leg.role === 'SHORT_CALL') {
      netDelta -= (leg.delta || 0.25);
      netDebitCredit += (leg.entryPrice || leg.premium || 0) * (strategy.underlying.sharesCount || 100);
    }
  }

  const updatedMetrics = {
    netDebitCredit: Number(netDebitCredit.toFixed(2)),
    floorProtectionPrice: floor || strategy.financialMetrics.floorProtectionPrice,
    netDelta: Number(netDelta.toFixed(4)),
    recalculatedAt: new Date().toISOString(),
  };

  const repo = getHedgingRepo(dbTarget);
  return await repo.updateMetrics(strategyId, updatedMetrics);
};

// GENERACIÓN DE LA MATRIZ VECTORIAL DE PAYOFF (P&L) PARA LA PWA
export const generatePayoffMatrix = async (strategyId, { steps = 25, rangePct = 0.25 } = {}, dbTarget = 'mongodb') => {
  const strategy = await getStrategyById(strategyId, dbTarget);
  const S0 = Number(strategy.underlying.spotPriceAtEntry || 100);
  const shares = Number(strategy.underlying.sharesCount || 100);

  const numSteps = Math.max(5, Math.min(100, Number(steps) || 25));
  const validRangePct = (Number(rangePct) > 0.01 && Number(rangePct) <= 2.0) ? Number(rangePct) : 0.25;

  const minPrice = Math.max(0.01, S0 * (1 - validRangePct));
  const maxPrice = S0 * (1 + validRangePct);
  const stepSize = Math.max(0.01, (maxPrice - minPrice) / numSteps);

  const putLeg = (strategy.legs || []).find((l) => l.legRole === 'HEDGE_FLOOR' || l.role === 'LONG_PUT');
  const callLeg = (strategy.legs || []).find((l) => l.legRole === 'FINANCE_CEILING' || l.role === 'SHORT_CALL');

  const K_put = putLeg ? Number(putLeg.strike || 0) : 0;
  const P_put = putLeg ? Number(putLeg.entryPrice || putLeg.premium || 0) : 0;
  const K_call = callLeg ? Number(callLeg.strike || 0) : 0;
  const P_call = callLeg ? Number(callLeg.entryPrice || callLeg.premium || 0) : 0;

  const netPremiumPerShare = (callLeg ? P_call : 0) - (putLeg ? P_put : 0);

  const points = [];
  for (let S_T = minPrice; S_T <= maxPrice + (stepSize * 0.1); S_T += stepSize) {
    const unhedgedPL = (S_T - S0) * shares;

    let optionPayoff = 0;
    if (putLeg && K_put > 0 && S_T < K_put) {
      optionPayoff += (K_put - S_T); // Ejercicio del Put
    }
    if (callLeg && K_call > 0 && S_T > K_call) {
      optionPayoff -= (S_T - K_call); // Obligación de venta del Call
    }

    const hedgedPL = (S_T - S0 + optionPayoff + netPremiumPerShare) * shares;

    points.push({
      simulatedSpot: Number(S_T.toFixed(2)),
      unhedgedPL: Number(unhedgedPL.toFixed(2)),
      hedgedPL: Number(hedgedPL.toFixed(2)),
      differenceUSD: Number((hedgedPL - unhedgedPL).toFixed(2)),
    });
  }

  return {
    strategyId,
    symbol: strategy.underlying.symbol,
    spotPriceAtEntry: S0,
    strategyType: strategy.strategyType,
    stepsCount: points.length,
    points,
  };
};

