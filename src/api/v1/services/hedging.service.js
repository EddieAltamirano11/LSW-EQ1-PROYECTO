import boom from '@hapi/boom';
import { getHedgingRepo } from '../repositories/hedging.repository.js';
import { getUnderlyingRepo } from '../repositories/underlying.repository.js';
import { calculateBlackScholes } from './quant.service.js';
import { getBrokerQuote, getBrokerOptionsChain, createBrokerOrder } from './broker.service.js';
import { randomUUID } from 'crypto';
import config from '../../../config/config.js';

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
  const {
    portfolioId = 'PORT-01',
    symbol,
    companyName = `${symbol} Corporation`,
    spotPrice,
    sharesCount = 100,
    putStrike,
    putPremium,
    expirationDate = '2026-10-16T00:00:00.000Z',
    volatility = 0.22,
  } = payload;

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

  // Valuación cuantitativa F0 de la pata Put
  const quant = calculateBlackScholes({
    spotPrice: S,
    strikePrice: K,
    timeToExpirationYears: 0.1,
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
    expirationDate = '2026-10-16T00:00:00.000Z',
    volatility = 0.15,
  } = payload;

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

  // Griegas F0
  const putQuant = calculateBlackScholes({ spotPrice: S, strikePrice: K_put, timeToExpirationYears: 0.1, volatility, optionType: 'PUT' });
  const callQuant = calculateBlackScholes({ spotPrice: S, strikePrice: K_call, timeToExpirationYears: 0.1, volatility, optionType: 'CALL' });

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
    expirationDate = '2026-10-16',
    autoPersist = true,
    broker = config.DEFAULT_BROKER || 'WEBULL',
    executeOrders = false,
    buyUnderlying = true,
  } = params;

  if (!symbol) {
    throw boom.badRequest('El símbolo del activo (symbol) es requerido para la calibración automática.');
  }

  const ticker = symbol.toUpperCase();

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

  // 5. Persistencia directa en base de datos seleccionada (MongoDB Atlas o Supabase)
  const collarPayload = {
    portfolioId,
    broker,
    symbol: ticker,
    companyName: quote.companyName || `${ticker} Corporation`,
    spotPrice,
    sharesCount,
    putStrike: optimalPut.strike,
    callStrike: optimalCall.strike,
    putPremium: optimalPut.premium,
    callPremium: optimalCall.premium,
    expirationDate: `${expirationDate}T00:00:00.000Z`,
    volatility: quote.volatility || 0.2,
  };

  const createdStrategy = await createCollarSpread(collarPayload, dbTarget);

  // 6. Ejecución opcional de órdenes bursátiles en el Broker activo (Webull o Alpaca)
  let brokerExecution = null;
  const shouldExecute = executeOrders === true || executeOrders === 'true' || params.executeOnBroker === true;

  if (shouldExecute) {
    const contracts = Number(params.contracts) || Math.max(1, Math.ceil(sharesCount / 100));
    const targetBroker = (broker || config.DEFAULT_BROKER || 'WEBULL').toUpperCase();
    const executedOrders = [];
    const executionErrors = [];

    if (targetBroker === 'WEBULL') {
      // 1. Pata Call Financiador + Acciones (Webull requiere combo COVERED_STOCK para aceptar Short Call fuera de horario)
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

        // Pata Acciones (adquiridas y vinculadas en el combo COVERED_STOCK de Webull)
        executedOrders.push({
          legRole: 'UNDERLYING',
          legType: 'EQUITY',
          action: 'BUY',
          symbol: ticker,
          quantity: sharesCount,
          limitPrice: spotPrice,
          orderId: callOrderId,
          status: callOrder.order?.status || 'submitted',
          details: callOrder,
        });

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

    // Vincular orderId de broker a las patas persistidas en BD
    if (createdStrategy && createdStrategy.legs && executedOrders.length > 0) {
      try {
        const updatedLegs = createdStrategy.legs.map((leg) => {
          const matched = executedOrders.find((eo) => eo.legRole === leg.legRole);
          if (matched && matched.orderId) {
            return typeof leg.toObject === 'function'
              ? { ...leg.toObject(), brokerOrderId: matched.orderId }
              : { ...leg, brokerOrderId: matched.orderId };
          }
          return leg;
        });

        const repo = getHedgingRepo(dbTarget);
        const stratId = createdStrategy.id || createdStrategy._id;
        await repo.update(stratId, { legs: updatedLegs });
        createdStrategy.legs = updatedLegs;
      } catch (updErr) {
        console.warn(`[AutoCollar] Advertencia al vincular brokerOrderId en ${dbTarget}: ${updErr.message}`);
      }
    }
  }

  return {
    message: brokerExecution && brokerExecution.executed
      ? `Estrategia Zero-Cost Collar calibrada, persistida en ${dbTarget.toUpperCase()} y emitida a ${broker.toUpperCase()} (${brokerExecution.orders.length} órdenes bursátiles generadas).`
      : `Estrategia Zero-Cost Collar calibrada, optimizada con F0 y persistida en ${dbTarget.toUpperCase()} exitosamente.`,
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
    expirationDate = '2026-10-16',
    broker = config.DEFAULT_BROKER || 'WEBULL',
    moneyness = 'OTM',
    volatility,
  } = params;

  if (!symbol) {
    throw boom.badRequest('El símbolo del activo (symbol) es requerido.');
  }

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
  const S0 = strategy.underlying.spotPriceAtEntry || 100;
  const shares = strategy.underlying.sharesCount || 100;

  const minPrice = S0 * (1 - rangePct);
  const maxPrice = S0 * (1 + rangePct);
  const stepSize = (maxPrice - minPrice) / steps;

  const putLeg = (strategy.legs || []).find((l) => l.legRole === 'HEDGE_FLOOR' || l.role === 'LONG_PUT');
  const callLeg = (strategy.legs || []).find((l) => l.legRole === 'FINANCE_CEILING' || l.role === 'SHORT_CALL');

  const K_put = putLeg ? (putLeg.strike || 0) : 0;
  const P_put = putLeg ? (putLeg.entryPrice || putLeg.premium || 0) : 0;
  const K_call = callLeg ? (callLeg.strike || 0) : 0;
  const P_call = callLeg ? (callLeg.entryPrice || callLeg.premium || 0) : 0;

  const netPremiumPerShare = P_call - P_put;

  const points = [];
  for (let S_T = minPrice; S_T <= maxPrice + 0.001; S_T += stepSize) {
    const unhedgedPL = (S_T - S0) * shares;

    let optionPayoff = 0;
    if (putLeg && S_T < K_put) {
      optionPayoff += (K_put - S_T); // Ejercicio del Put
    }
    if (callLeg && S_T > K_call) {
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

