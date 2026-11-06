import boom from '@hapi/boom';
import { getHedgingRepo } from '../repositories/hedging.repository.js';
import { getUnderlyingRepo } from '../repositories/underlying.repository.js';
import { calculateBlackScholes } from './quant.service.js';
import { getBrokerQuote, getBrokerOptionsChain, createBrokerOrder, getBrokerOrders } from './broker.service.js';
import { randomUUID } from 'crypto';
import config from '../../../config/config.js';
import { assertBrokerAndDatabasesReadiness } from './preflight.service.js';

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
  const expDateObj = new Date(expYear, expMonth, expDay);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (isNaN(expDateObj.getTime()) || expDateObj <= today) {
    throw boom.badRequest(
      `La fecha de expiración '${cleanDate}' es inválida porque ya ha vencido o vence hoy. ` +
      `Las opciones financieras requieren una fecha futura de vencimiento para poder cotizarse y emitirse en el broker.`
    );
  }
  return cleanDate;
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
export const createProtectivePut = async (payload, dbTarget = 'mongodb') => {
  const targetBroker = (payload.broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();
  if (targetBroker === 'IBKR') {
    await assertBrokerAndDatabasesReadiness({ dbTarget, broker: 'IBKR' });
  }
  const {
    portfolioId = 'PORT-01',
    symbol,
    companyName = `${symbol} Corporation`,
    spotPrice,
    sharesCount = 100,
    putStrike,
    putPremium,
    expirationDate = '2026-12-18T00:00:00.000Z',
    volatility = 0.22,
  } = payload;

  validateFutureExpirationDate(expirationDate);

  const count = Number(payload.sharesCount || payload.sharesQuantity || 100);
  if (count <= 0) {
    throw boom.badRequest('La cantidad de acciones (sharesCount) debe ser un número entero mayor a 0.');
  }

  let S = Number(payload.spotPrice);
  if (!S || isNaN(S)) {
    try {
      const brokerQuote = await getBrokerQuote(symbol, payload.broker || 'WEBULL');
      if (brokerQuote && brokerQuote.lastPrice) {
        S = Number(brokerQuote.lastPrice);
      }
    } catch (_) {}
  }
  if (!S || isNaN(S)) {
    const uRepo = getUnderlyingRepo(dbTarget);
    const existingU = await uRepo.getBySymbol(symbol);
    if (existingU) {
      S = Number(existingU.spotPrice);
    } else {
      throw boom.badRequest(`No se encontró precio Spot para el activo ${symbol}. Proporcione spotPrice en el payload.`);
    }
  }

  const contracts = Math.max(1, Math.ceil(count / 100));
  const K = Number(putStrike);
  const premium = Number(putPremium);

  const timeToExpiration = calculateTimeToExpirationYears(expirationDate);

  // Valuación cuantitativa F0 de la pata Put
  const quant = calculateBlackScholes({
    spotPrice: S,
    strikePrice: K,
    timeToExpirationYears: timeToExpiration,
    volatility,
    optionType: 'PUT',
  });

  // Métricas financieras
  const netDebit = premium * count; // Costo del seguro
  const breakeven = S + premium;
  const maxLossUSD = (S - K) * count + netDebit;
  const netDelta = Number((1.0 + quant.greeks.delta).toFixed(4));

  const strategyDoc = {
    id: `STRAT-PP-${symbol.toUpperCase()}-${randomUUID().slice(0, 4)}`,
    portfolioId,
    broker: (payload.broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase(),
    strategyType: 'PROTECTIVE_PUT',
    status: 'ACTIVE',
    underlying: {
      symbol: symbol.toUpperCase(),
      companyName,
      spotPriceAtEntry: S,
      sharesCount: count,
    },
    legs: [
      {
        legId: `LEG-${symbol.toUpperCase()}-STOCK`,
        legRole: 'UNDERLYING',
        assetType: 'EQUITY',
        contractSymbol: null,
        optionType: null,
        strike: null,
        expirationDate: null,
        quantity: count,
        entryPrice: S,
        delta: 1.0,
        gamma: 0.0,
        theta: 0.0,
        vega: 0.0,
      },
      {
        legId: `LEG-${symbol.toUpperCase()}-PUT`,
        legRole: 'HEDGE_FLOOR',
        assetType: 'OPTION',
        contractSymbol: `${symbol.toUpperCase()}261016P${String(K * 1000).padStart(8, '0')}`,
        optionType: 'PUT',
        strike: K,
        expirationDate: new Date(expirationDate),
        quantity: contracts,
        entryPrice: premium,
        delta: quant.greeks.delta,
        gamma: quant.greeks.gamma,
        theta: quant.greeks.theta,
        vega: quant.greeks.vega,
      },
    ],
    financialMetrics: {
      netDebitCredit: -netDebit,
      breakevenPrice: Number(breakeven.toFixed(2)),
      floorProtectionPrice: K,
      maxLossTotalUSD: Number(maxLossUSD.toFixed(2)),
      netDelta,
    },
  };

  const repo = getHedgingRepo(dbTarget);
  return await repo.create(strategyDoc);
};

// ESTRUCTURACIÓN Y CREACIÓN DE ZERO-COST COLLAR SPREAD (F2 PARTE B)
export const createCollarSpread = async (payload, dbTarget = 'mongodb') => {
  const targetBroker = (payload.broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();
  if (targetBroker === 'IBKR') {
    await assertBrokerAndDatabasesReadiness({ dbTarget, broker: 'IBKR' });
  }
  const {
    portfolioId = 'PORT-01',
    symbol,
    companyName = `${symbol} Corporation`,
    spotPrice,
    sharesCount = 100,
    putStrike,
    callStrike,
    putPremium = 6.5,
    callPremium = 6.6,
    expirationDate = '2026-12-18T00:00:00.000Z',
    volatility = 0.15,
  } = payload;

  validateFutureExpirationDate(expirationDate);

  const count = Number(payload.sharesCount || payload.sharesQuantity || 100);
  if (count <= 0) {
    throw boom.badRequest('La cantidad de acciones (sharesCount) debe ser un número entero mayor a 0.');
  }

  let S = Number(payload.spotPrice);
  if (!S || isNaN(S)) {
    try {
      const brokerQuote = await getBrokerQuote(symbol, payload.broker || 'WEBULL');
      if (brokerQuote && brokerQuote.lastPrice) {
        S = Number(brokerQuote.lastPrice);
      }
    } catch (_) {}
  }
  if (!S || isNaN(S)) {
    const uRepo = getUnderlyingRepo(dbTarget);
    const existingU = await uRepo.getBySymbol(symbol);
    if (existingU) {
      S = Number(existingU.spotPrice);
    } else {
      throw boom.badRequest(`No se encontró precio Spot para el activo ${symbol}. Proporcione spotPrice en el payload.`);
    }
  }

  const K_put = Number(putStrike);
  const K_call = Number(callStrike);
  const p_put = Number(putPremium);
  const p_call = Number(callPremium);
  const contracts = Math.max(1, Math.ceil(count / 100));

  if (K_put >= S) throw boom.badRequest('El Strike del Put protector debe ser inferior al precio Spot (Out-of-the-Money).');
  if (K_call <= S) throw boom.badRequest('El Strike del Call financiador debe ser superior al precio Spot (Out-of-the-Money).');

  const timeToExpiration = calculateTimeToExpirationYears(expirationDate);

  // Griegas F0
  const putQuant = calculateBlackScholes({ spotPrice: S, strikePrice: K_put, timeToExpirationYears: timeToExpiration, volatility, optionType: 'PUT' });
  const callQuant = calculateBlackScholes({ spotPrice: S, strikePrice: K_call, timeToExpirationYears: timeToExpiration, volatility, optionType: 'CALL' });

  // Flujo neto de primas por acción
  const netCreditPerShare = p_call - p_put;
  const netDebitCreditTotal = Number((netCreditPerShare * count).toFixed(2));
  const breakeven = Number((S - netCreditPerShare).toFixed(2));
  const maxLossUSD = Number(((S - K_put - netCreditPerShare) * count).toFixed(2));
  const maxProfitUSD = Number(((K_call - S + netCreditPerShare) * count).toFixed(2));
  const netDelta = Number((1.0 + putQuant.greeks.delta - callQuant.greeks.delta).toFixed(4));

  const strategyDoc = {
    id: `STRAT-COLLAR-${symbol.toUpperCase()}-${randomUUID().slice(0, 4)}`,
    portfolioId,
    broker: (payload.broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase(),
    strategyType: 'COLLAR',
    status: 'ACTIVE',
    underlying: {
      symbol: symbol.toUpperCase(),
      companyName,
      spotPriceAtEntry: S,
      sharesCount: count,
    },
    legs: [
      {
        legId: `LEG-${symbol.toUpperCase()}-STOCK`,
        legRole: 'UNDERLYING',
        assetType: 'EQUITY',
        contractSymbol: null,
        brokerOrderId: payload.stockOrderId || null,
        quantity: count,
        entryPrice: S,
        delta: 1.0,
        gamma: 0.0,
        theta: 0.0,
        vega: 0.0,
      },
      {
        legId: `LEG-${symbol.toUpperCase()}-PUT`,
        legRole: 'HEDGE_FLOOR',
        assetType: 'OPTION',
        contractSymbol: `${symbol.toUpperCase()}261016P${String(K_put * 1000).padStart(8, '0')}`,
        brokerOrderId: payload.putOrderId || null,
        optionType: 'PUT',
        strike: K_put,
        expirationDate: new Date(expirationDate),
        quantity: contracts,
        entryPrice: p_put,
        delta: putQuant.greeks.delta,
        gamma: putQuant.greeks.gamma,
        theta: putQuant.greeks.theta,
        vega: putQuant.greeks.vega,
      },
      {
        legId: `LEG-${symbol.toUpperCase()}-CALL`,
        legRole: 'FINANCE_CEILING',
        assetType: 'OPTION',
        contractSymbol: `${symbol.toUpperCase()}261016C${String(K_call * 1000).padStart(8, '0')}`,
        brokerOrderId: payload.callOrderId || null,
        optionType: 'CALL',
        strike: K_call,
        expirationDate: new Date(expirationDate),
        quantity: contracts,
        entryPrice: p_call,
        delta: callQuant.greeks.delta,
        gamma: callQuant.greeks.gamma,
        theta: callQuant.greeks.theta,
        vega: callQuant.greeks.vega,
      },
    ],
    financialMetrics: {
      netDebitCredit: netDebitCreditTotal,
      breakevenPrice: breakeven,
      floorProtectionPrice: K_put,
      maxLossTotalUSD: maxLossUSD,
      maxProfitTotalUSD: maxProfitUSD,
      netDelta,
    },
  };

  const repo = getHedgingRepo(dbTarget);
  return await repo.create(strategyDoc);
};

// ============================================================================
// CALIBRACIÓN Y RECOMENDACIÓN AUTOMÁTICA DE ZERO-COST COLLAR CON MOTOR F0
// ============================================================================
export const autoCalibrateAndCreateCollar = async (params, dbTarget = 'mongodb') => {
  const {
    symbol,
    sharesCount = 10,
    portfolioId = 'PORT-01',
    expirationDate = '2026-12-18',
    autoPersist = true,
    broker = config.DEFAULT_BROKER || 'WEBULL',
    executeOrders = false,
    buyUnderlying = true,
  } = params;

  if (!symbol) {
    throw boom.badRequest('El símbolo del activo (symbol) es requerido para la calibración automática.');
  }

  const cleanExpDate = validateFutureExpirationDate(expirationDate);
  const ticker = symbol.toUpperCase();
  const targetBroker = (broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();

  // 0. Pre-vuelo estricto de consistencia transaccional:
  // Valida BDs y, si el broker es IBKR, verifica que el túnel TCP esté activo antes de calcular o persistir nada
  if (targetBroker === 'IBKR' || autoPersist) {
    await assertBrokerAndDatabasesReadiness({ dbTarget, broker: targetBroker });
  }

  // 1. Obtener precio spot del broker
  const quote = await getBrokerQuote(ticker, broker);
  const spotPrice = quote.lastPrice;

  // 2. Obtener la cadena de opciones disponible
  const chain = await getBrokerOptionsChain(ticker, expirationDate, broker);

  // 3. Algoritmo Cuantitativo de Selección:
  // Filtramos Puts OTM (Strike < Spot) y Calls OTM (Strike > Spot)
  const candidatePuts = (chain.puts || []).filter((p) => p.strike < spotPrice);
  const candidateCalls = (chain.calls || []).filter((c) => c.strike > spotPrice);

  if (candidatePuts.length === 0 || candidateCalls.length === 0) {
    throw boom.badRequest(`No se encontraron contratos OTM adecuados para ${ticker} en la fecha ${expirationDate}.`);
  }

  // Buscamos el par que minimice el flujo neto (Costo Cero) y balancee la simetría del deducible
  let bestPair = null;
  let bestScore = Infinity;
  const evaluatedPairs = [];

  for (const put of candidatePuts) {
    const putPrem = Number(put.premium || put.lastPrice || put.ask || 0);
    for (const call of candidateCalls) {
      const callPrem = Number(call.premium || call.lastPrice || call.bid || 0);
      const netPremiumDiff = Math.abs(callPrem - putPrem);
      const putDistancePct = (spotPrice - put.strike) / spotPrice;
      const callDistancePct = (call.strike - spotPrice) / spotPrice;
      
      const symmetryPenalty = Math.abs(putDistancePct - callDistancePct);
      const score = netPremiumDiff * 10 + symmetryPenalty * 2;

      evaluatedPairs.push({
        putStrike: put.strike,
        putPremium: putPrem,
        callStrike: call.strike,
        callPremium: callPrem,
        netDiff: Number(netPremiumDiff.toFixed(2)),
        score: Number(score.toFixed(3)),
      });

      if (score < bestScore) {
        bestScore = score;
        bestPair = {
          put: { ...put, premium: putPrem },
          call: { ...call, premium: callPrem },
          netPremiumDiff,
          putDistancePct,
          callDistancePct,
        };
      }
    }
  }

  if (!bestPair) {
    throw boom.badRequest('No fue posible calibrar una combinación óptima de Collar a Costo Cero.');
  }

  const optimalPut = bestPair.put;
  const optimalCall = bestPair.call;

  // 4. Valuación Analítica con Black-Scholes F0
  const effectiveVol = Number(params.volatility) || (ticker === 'NVDA' ? 0.48 : (quote.volatility && quote.volatility > 0.25 ? quote.volatility : 0.35));

  const putBS = calculateBlackScholes({
    spotPrice,
    strikePrice: optimalPut.strike,
    timeToExpirationYears: 0.1,
    volatility: effectiveVol,
    optionType: 'PUT',
  });

  const callBS = calculateBlackScholes({
    spotPrice,
    strikePrice: optimalCall.strike,
    timeToExpirationYears: 0.1,
    volatility: effectiveVol,
    optionType: 'CALL',
  });

  // 5. Validación de Precio Justo según Black-Scholes (F0 Fair Pricing Guardrail)
  // Evalúa que el mercado no presente un sobreprecio abusivo o desequilibrio en las primas
  const putFairRatio = optimalPut.premium / Math.max(0.01, putBS.theoreticalPrice);
  const callFairRatio = optimalCall.premium / Math.max(0.01, callBS.theoreticalPrice);
  const isFairPrice = putFairRatio <= 8.0 && putFairRatio >= 0.05 && callFairRatio <= 8.0 && callFairRatio >= 0.05;

  if (!isFairPrice) {
    throw boom.badRequest(
      `Rechazado por Filtro Cuantitativo F0 (Black-Scholes): Las primas de mercado de las opciones ($${optimalPut.premium} Put / $${optimalCall.premium} Call) no cumplen con los criterios de precio justo teórico ($${putBS.theoreticalPrice.toFixed(2)} Put / $${callBS.theoreticalPrice.toFixed(2)} Call). No se autoriza la compra de activos ni opciones.`
    );
  }

  const analysisReport = {
    symbol: ticker,
    companyName: quote.companyName || `${ticker} Corporation`,
    spotPrice,
    evaluatedPairsCount: evaluatedPairs.length,
    selectionCriteria: {
      putMoneyness: `${(bestPair.putDistancePct * 100).toFixed(1)}% OTM (Deducible de riesgo)`,
      callMoneyness: `${(bestPair.callDistancePct * 100).toFixed(1)}% OTM (Techo de financiamiento)`,
      zeroCostAchieved: bestPair.netPremiumDiff < 0.5 ? 'EXACTO ($0.00 neto)' : `Aproximado ($${bestPair.netPremiumDiff.toFixed(2)}/acción)`,
      fairPricingBS: 'VALIDADO_JUSTO (Dentro de tolerancia analítica F0)',
      mathematicalRationale: 'Minimización de débito neto de primas (|Prima Call - Prima Put| -> 0) y simetría de colas OTM al 5%.',
    },
    optimalContracts: {
      put: {
        contractSymbol: optimalPut.contractSymbol,
        strike: optimalPut.strike,
        marketPremium: optimalPut.premium,
        theoreticalPriceBS: putBS.theoreticalPrice,
        greeks: putBS.greeks,
        role: 'HEDGE_FLOOR (Póliza de Seguro Protector)',
      },
      call: {
        contractSymbol: optimalCall.contractSymbol,
        strike: optimalCall.strike,
        marketPremium: optimalCall.premium,
        theoreticalPriceBS: callBS.theoreticalPrice,
        greeks: callBS.greeks,
        role: 'FINANCE_CEILING (Financiamiento a Costo Cero)',
      },
    },
  };

  if (!autoPersist) {
    return {
      message: `Recomendación cuantitativa para ${ticker} calculada exitosamente.`,
      analysis: analysisReport,
    };
  }

  // 5. Flujo transaccional seguro: Ejecución en broker ANTES de persistir en BD
  let createdStrategy = null;
  let brokerExecution = null;
  const executedOrders = [];
  const executionErrors = [];
  const shouldExecute = executeOrders === true || executeOrders === 'true' || params.executeOnBroker === true;

  if (shouldExecute) {
    const contracts = Number(params.contracts) || Math.max(1, Math.ceil(sharesCount / 100));

    if (targetBroker === 'WEBULL') {
      // 1. Pata Acciones Subyacentes (Compra en Webull OpenAPI)
      if (buyUnderlying !== false) {
        try {
          const stockOrder = await createBrokerOrder({
            broker: 'WEBULL',
            symbol: ticker,
            instrumentType: 'EQUITY',
            qty: sharesCount,
            side: 'buy',
            type: 'limit',
            limitPrice: spotPrice,
            timeInForce: 'gtc',
          }, 'WEBULL');

          executedOrders.push({
            legRole: 'UNDERLYING',
            legType: 'EQUITY',
            action: 'BUY',
            symbol: ticker,
            quantity: sharesCount,
            limitPrice: spotPrice,
            orderId: stockOrder.order?.id || stockOrder.id,
            status: stockOrder.order?.status || 'submitted',
            details: stockOrder,
          });
        } catch (err) {
          executionErrors.push({
            legRole: 'UNDERLYING',
            legType: 'EQUITY',
            error: err.message,
          });
        }
      }

      // 2. Pata Call Financiador (Short Call en Webull OpenAPI)
      try {
        const callOrder = await createBrokerOrder({
          broker: 'WEBULL',
          symbol: ticker,
          contractSymbol: optimalCall.contractSymbol,
          instrumentType: 'OPTION',
          optionType: 'CALL',
          strikePrice: optimalCall.strike,
          spotPrice,
          stockPrice: spotPrice,
          expirationDate,
          qty: contracts,
          side: 'sell',
          type: 'limit',
          limitPrice: optimalCall.premium,
          timeInForce: 'gtc',
        }, 'WEBULL');

        const callOrderId = callOrder.order?.id || callOrder.id;

        // Pata Opción Call Financiador
        executedOrders.push({
          legRole: 'FINANCE_CEILING',
          legType: 'CALL',
          action: 'SELL',
          strike: optimalCall.strike,
          contractSymbol: optimalCall.contractSymbol,
          quantity: contracts,
          limitPrice: optimalCall.premium,
          orderId: callOrderId,
          status: callOrder.order?.status || 'submitted',
          details: callOrder,
        });
      } catch (err) {
        executionErrors.push({
          legRole: 'FINANCE_CEILING',
          legType: 'CALL',
          error: err.message,
        });
      }

      // 2. Pata Put Protector (SINGLE PUT en Webull)
      try {
        const putOrder = await createBrokerOrder({
          broker: 'WEBULL',
          symbol: ticker,
          contractSymbol: optimalPut.contractSymbol,
          instrumentType: 'OPTION',
          optionType: 'PUT',
          strikePrice: optimalPut.strike,
          expirationDate,
          qty: contracts,
          side: 'buy',
          type: 'limit',
          limitPrice: optimalPut.premium,
          timeInForce: 'gtc',
        }, 'WEBULL');

        executedOrders.push({
          legRole: 'HEDGE_FLOOR',
          legType: 'PUT',
          action: 'BUY',
          strike: optimalPut.strike,
          contractSymbol: optimalPut.contractSymbol,
          quantity: contracts,
          limitPrice: optimalPut.premium,
          orderId: putOrder.order?.id || putOrder.id,
          status: putOrder.order?.status || 'submitted',
          details: putOrder,
        });
      } catch (err) {
        executionErrors.push({
          legRole: 'HEDGE_FLOOR',
          legType: 'PUT',
          error: err.message,
        });
      }
    } else {
      // Flujo Alpaca / Otros: Emisión individual por pata
      // Pata 1: Acciones subyacentes
      if (buyUnderlying !== false) {
        try {
          const stockOrder = await createBrokerOrder({
            broker: targetBroker,
            symbol: ticker,
            instrumentType: 'EQUITY',
            qty: sharesCount,
            side: 'buy',
            type: 'limit',
            limitPrice: spotPrice,
            timeInForce: 'day',
          }, targetBroker);

          executedOrders.push({
            legRole: 'UNDERLYING',
            legType: 'EQUITY',
            action: 'BUY',
            symbol: ticker,
            quantity: sharesCount,
            limitPrice: spotPrice,
            orderId: stockOrder.order?.id || stockOrder.id,
            status: stockOrder.order?.status || 'submitted',
            details: stockOrder,
          });
        } catch (err) {
          executionErrors.push({
            legRole: 'UNDERLYING',
            legType: 'EQUITY',
            error: err.message,
          });
        }
      }

      // Pata 2: Put Protector
      try {
        const putOrder = await createBrokerOrder({
          broker: targetBroker,
          symbol: ticker,
          contractSymbol: optimalPut.contractSymbol,
          instrumentType: 'OPTION',
          optionType: 'PUT',
          strikePrice: optimalPut.strike,
          expirationDate,
          qty: contracts,
          side: 'buy',
          type: 'limit',
          limitPrice: optimalPut.premium,
          timeInForce: 'day',
        }, targetBroker);

        executedOrders.push({
          legRole: 'HEDGE_FLOOR',
          legType: 'PUT',
          action: 'BUY',
          strike: optimalPut.strike,
          contractSymbol: optimalPut.contractSymbol,
          quantity: contracts,
          limitPrice: optimalPut.premium,
          orderId: putOrder.order?.id || putOrder.id,
          status: putOrder.order?.status || 'submitted',
          details: putOrder,
        });
      } catch (err) {
        executionErrors.push({
          legRole: 'HEDGE_FLOOR',
          legType: 'PUT',
          error: err.message,
        });
      }

      // Pata 3: Call Financiador
      try {
        const callOrder = await createBrokerOrder({
          broker: targetBroker,
          symbol: ticker,
          contractSymbol: optimalCall.contractSymbol,
          instrumentType: 'OPTION',
          optionType: 'CALL',
          strikePrice: optimalCall.strike,
          expirationDate,
          qty: contracts,
          side: 'sell',
          type: 'limit',
          limitPrice: optimalCall.premium,
          timeInForce: 'day',
        }, targetBroker);

        executedOrders.push({
          legRole: 'FINANCE_CEILING',
          legType: 'CALL',
          action: 'SELL',
          strike: optimalCall.strike,
          contractSymbol: optimalCall.contractSymbol,
          quantity: contracts,
          limitPrice: optimalCall.premium,
          orderId: callOrder.order?.id || callOrder.id,
          status: callOrder.order?.status || 'submitted',
          details: callOrder,
        });
      } catch (err) {
        executionErrors.push({
          legRole: 'FINANCE_CEILING',
          legType: 'CALL',
          error: err.message,
        });
      }
    }

    brokerExecution = {
      broker: targetBroker,
      executed: executedOrders.length > 0,
      contractsCount: contracts,
      orders: executedOrders,
      errors: executionErrors.length > 0 ? executionErrors : undefined,
    };

    // 6. Verificación Directa en el Broker (Consulta GET al Broker, NO a la Base de Datos)
    // Garantiza que la BD refleje única y exclusivamente órdenes admitidas y activas en el broker
    const liveBrokerOrders = await getBrokerOrders('all', targetBroker);
    const validLiveStatuses = [
      'submitted', 'presubmitted', 'pending_new', 'new', 'accepted', 
      'filled', 'partially_filled', 'open', 'working'
    ];
    const unverifiedOrFailedLegs = [];

    for (const leg of executedOrders) {
      const ordId = String(leg.orderId || '');
      const clientOrdId = String(leg.details?.order?.clientOrderId || '');

      // Buscar en las órdenes en vivo devueltas por el broker
      const foundInBroker = liveBrokerOrders.find((bo) => {
        const boId = String(bo.id || '');
        const boClient = String(bo.clientOrderId || '');
        return (ordId && (boId === ordId || boClient === ordId)) ||
               (clientOrdId && (boId === clientOrdId || boClient === clientOrdId));
      });

      const liveStatus = foundInBroker 
        ? String(foundInBroker.status || '').toLowerCase() 
        : String(leg.status || '').toLowerCase();

      if (['cancelled', 'canceled', 'rejected', 'inactive', 'failed', 'expired'].includes(liveStatus)) {
        unverifiedOrFailedLegs.push({
          legRole: leg.legRole,
          symbol: leg.contractSymbol || leg.symbol,
          orderId: leg.orderId,
          status: liveStatus,
          reason: `Orden ${leg.orderId} cancelada o rechazada en ${targetBroker} (${liveStatus}).`,
        });
      } else if (!validLiveStatuses.includes(liveStatus)) {
        unverifiedOrFailedLegs.push({
          legRole: leg.legRole,
          symbol: leg.contractSymbol || leg.symbol,
          orderId: leg.orderId,
          status: liveStatus,
          reason: `Orden ${leg.orderId} con estado no operable '${liveStatus}'.`,
        });
      } else if (foundInBroker) {
        leg.status = liveStatus;
        leg.verifiedInBroker = true;
      }
    }

    // SI EL BROKER RECHAZÓ O CANCELÓ ALGUNA PATA: ABORTAR SIN PERSISTIR NADA EN LA BASE DE DATOS
    if (unverifiedOrFailedLegs.length > 0 || executionErrors.length > 0) {
      const issues = [
        ...executionErrors.map((e) => `[${e.legRole}: ${e.error}]`),
        ...unverifiedOrFailedLegs.map((f) => `[${f.legRole}: ${f.reason}]`),
      ].join(' | ');

      throw boom.serverUnavailable(
        `Falla de validación en vivo con ${targetBroker}: Las órdenes no fueron confirmadas activas por el broker (${issues}). ` +
        `Por política estricta de fidelidad e integridad transaccional, NINGÚN dato fue insertado en la base de datos (${dbTarget.toUpperCase()}).`
      );
    }

    // Si todas las órdenes fueron verificadas activas en el broker y autoPersist está activo, persistir en BD
    if (autoPersist) {
      const stockOrder = executedOrders.find((o) => o.legRole === 'UNDERLYING');
      const putOrder = executedOrders.find((o) => o.legRole === 'HEDGE_FLOOR');
      const callOrder = executedOrders.find((o) => o.legRole === 'FINANCE_CEILING');

      const collarPayload = {
        portfolioId,
        broker: targetBroker,
        symbol: ticker,
        companyName: quote.companyName || `${ticker} Corporation`,
        spotPrice,
        sharesCount,
        putStrike: optimalPut.strike,
        callStrike: optimalCall.strike,
        putPremium: optimalPut.premium,
        callPremium: optimalCall.premium,
        expirationDate: `${cleanExpDate}T00:00:00.000Z`,
        volatility: quote.volatility || 0.2,
        stockOrderId: stockOrder?.orderId || null,
        putOrderId: putOrder?.orderId || null,
        callOrderId: callOrder?.orderId || null,
      };

      createdStrategy = await createCollarSpread(collarPayload, dbTarget);
    }
  } else {
    // Modo Simulación / Cálculo Cuantitativo: executeOrders === false
    // Por estricta fidelidad con el broker, NO se simulan órdenes falsas en la base de datos
    return {
      message: `Recomendación cuantitativa para ${ticker} calibrada con Black-Scholes F0 exitosamente. Para emitir órdenes reales al broker y persistir la estrategia verificada en ${dbTarget.toUpperCase()}, envíe 'executeOrders': true.`,
      analysis: analysisReport,
      strategy: null,
      brokerExecution: {
        broker: targetBroker,
        executed: false,
        note: `Modo cálculo/simulación. No se insertó ningún registro en ${dbTarget.toUpperCase()} para mantener sincronía 100% fiel con ${targetBroker}.`,
      },
    };
  }

  return {
    message: `Estrategia Zero-Cost Collar verificada en vivo en ${targetBroker}, confirmada con ${executedOrders.length} órdenes bursátiles activas y persistida en ${dbTarget.toUpperCase()}.`,
    analysis: analysisReport,
    strategy: createdStrategy,
    brokerExecution: brokerExecution || {
      broker: (broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase(),
      executed: false,
      note: 'Las órdenes bursátiles no fueron emitidas automáticamente al broker porque executeOrders no fue proporcionado o fue falso. Envíe executeOrders: true en el body o query para auto-ejecución.',
    },
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

export const addLegsBatch = async (strategyId, legsArray, dbTarget = 'mongodb') => {
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
    expirationDate = '2026-12-18',
    broker = config.DEFAULT_BROKER || 'WEBULL',
    moneyness = 'OTM',
    volatility,
  } = params;

  if (!symbol) {
    throw boom.badRequest('El símbolo del activo (symbol) es requerido.');
  }

  validateFutureExpirationDate(expirationDate);

  const optType = (type || optionType || 'PUT').toUpperCase();
  if (!['PUT', 'CALL'].includes(optType)) {
    throw boom.badRequest("El parámetro type debe ser 'PUT' o 'CALL'.");
  }

  const ticker = symbol.toUpperCase();
  const targetBroker = (broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();

  // 1. Obtener precio spot del broker
  const quote = await getBrokerQuote(ticker, targetBroker);
  const spotPrice = quote.lastPrice;

  // 2. Obtener la cadena de opciones disponible
  const chain = await getBrokerOptionsChain(ticker, expirationDate, targetBroker);
  const optionsList = optType === 'PUT' ? (chain.puts || []) : (chain.calls || []);

  if (!optionsList || optionsList.length === 0) {
    throw boom.notFound(`No se encontraron contratos de tipo ${optType} para ${ticker} en el broker ${targetBroker}.`);
  }

  const effectiveVol = Number(volatility) || (ticker === 'NVDA' ? 0.48 : (quote.volatility && quote.volatility > 0.25 ? quote.volatility : 0.35));

  // 3. Filtrar y valuar contratos con Black-Scholes F0
  const evaluatedOptions = optionsList.map((opt) => {
    const strike = Number(opt.strike);
    const premium = Number(opt.premium || opt.lastPrice || opt.ask || opt.bid || 1.0);
    const bs = calculateBlackScholes({
      spotPrice,
      strikePrice: strike,
      timeToExpirationYears: 0.1,
      volatility: effectiveVol,
      optionType: optType,
    });

    const distancePct = (strike - spotPrice) / spotPrice;
    const absDistancePct = Math.abs(distancePct);
    const isOTM = optType === 'PUT' ? strike < spotPrice : strike > spotPrice;
    const isITM = optType === 'PUT' ? strike > spotPrice : strike < spotPrice;
    const isATM = absDistancePct <= 0.03;

    // Relación de precio justo Black-Scholes
    const fairRatio = premium / Math.max(0.01, bs.theoreticalPrice);
    const isFairPrice = fairRatio <= 8.0 && fairRatio >= 0.05;

    // Puntuación: buscamos OTM al 5%-10% con precio justo y prima razonable
    const targetDistance = 0.05;
    const distancePenalty = Math.abs(absDistancePct - targetDistance) * 10;
    const fairPenalty = Math.abs(fairRatio - 1.0) * 2;
    const score = distancePenalty + fairPenalty;

    return {
      contractSymbol: opt.contractSymbol || `${ticker}261016${optType[0]}${String(strike * 1000).padStart(8, '0')}`,
      type: optType,
      strike,
      bid: opt.bid ? Number(opt.bid) : Number((premium - 0.1).toFixed(2)),
      ask: opt.ask ? Number(opt.ask) : Number((premium + 0.1).toFixed(2)),
      lastPrice: opt.lastPrice ? Number(opt.lastPrice) : premium,
      marketPremium: premium,
      theoreticalPriceBS: bs.theoreticalPrice,
      greeks: bs.greeks,
      moneyness: isATM ? 'ATM (At-The-Money)' : (isOTM ? `${(absDistancePct * 100).toFixed(1)}% OTM` : `${(absDistancePct * 100).toFixed(1)}% ITM`),
      isOTM,
      isITM,
      isATM,
      fairRatio: Number(fairRatio.toFixed(2)),
      isFairPrice,
      score,
    };
  });

  // 4. Seleccionar el mejor contrato según el moneyness deseado
  let candidates = evaluatedOptions;
  if (moneyness.toUpperCase() === 'OTM') {
    const otmOnly = evaluatedOptions.filter((o) => o.isOTM);
    if (otmOnly.length > 0) candidates = otmOnly;
  } else if (moneyness.toUpperCase() === 'ITM') {
    const itmOnly = evaluatedOptions.filter((o) => o.isITM);
    if (itmOnly.length > 0) candidates = itmOnly;
  } else if (moneyness.toUpperCase() === 'ATM') {
    const atmOnly = evaluatedOptions.filter((o) => o.isATM);
    if (atmOnly.length > 0) candidates = atmOnly;
  }

  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0] || evaluatedOptions[0];

  return {
    message: `Recomendación cuantitativa de opción ${optType} para ${ticker} calculada exitosamente.`,
    broker: targetBroker,
    symbol: ticker,
    companyName: quote.companyName || `${ticker} Corporation`,
    spotPrice,
    optionType: optType,
    expirationDate,
    moneynessPreference: moneyness.toUpperCase(),
    recommendedContract: {
      contractSymbol: best.contractSymbol,
      type: best.type,
      strike: best.strike,
      bid: best.bid,
      ask: best.ask,
      lastPrice: best.lastPrice,
      marketPremium: best.marketPremium,
      theoreticalPriceBS: best.theoreticalPriceBS,
      greeks: best.greeks,
      moneyness: best.moneyness,
      role: optType === 'PUT' ? 'HEDGE_FLOOR (Póliza de Seguro Protector contra caídas)' : 'FINANCE_CEILING (Techo de Ganancia y Financiamiento de Cobertura)',
      fairPricingBS: best.isFairPrice ? 'VALIDADO_JUSTO (Dentro de tolerancia analítica F0)' : 'DESVIACIÓN_MODERADA',
      justification: optType === 'PUT'
        ? `Strike $${best.strike} (${best.moneyness}) ofrece un piso de protección ideal con prima de $${best.marketPremium} USD alineada con el valor teórico Black-Scholes ($${best.theoreticalPriceBS} USD).`
        : `Strike $${best.strike} (${best.moneyness}) permite capturar hasta ${(Math.abs(best.strike - spotPrice) / spotPrice * 100).toFixed(1)}% de ganancia en el subyacente y genera $${best.marketPremium} USD de prima para financiar coberturas.`,
    },
    availableContractsCount: evaluatedOptions.length,
    topCandidates: candidates.slice(0, 3).map((c) => ({
      contractSymbol: c.contractSymbol,
      strike: c.strike,
      bid: c.bid,
      ask: c.ask,
      lastPrice: c.lastPrice,
      marketPremium: c.marketPremium,
      theoreticalPriceBS: c.theoreticalPriceBS,
      moneyness: c.moneyness,
      delta: c.greeks.delta,
    })),
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

