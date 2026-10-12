import boom from '@hapi/boom';

// Aproximación de la Función de Distribución Normal Estándar Acumulada N(x)
export const standardNormalCDF = (x) => {
  const b1 = 0.31938153;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.3989422804014327; // 1 / sqrt(2 * PI)

  if (x >= 0.0) {
    const t = 1.0 / (1.0 + p * x);
    return 1.0 - c * Math.exp((-x * x) / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  } else {
    const t = 1.0 / (1.0 - p * x);
    return c * Math.exp((-x * x) / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  }
};

// Función de Densidad Normal Estándar N'(x)
export const standardNormalPDF = (x) => {
  return (1.0 / Math.sqrt(2.0 * Math.PI)) * Math.exp(-0.5 * x * x);
};

// Valuación analítica Black-Scholes (1973) y cálculo de las 5 Griegas
export const calculateBlackScholes = ({
  spotPrice,
  strikePrice,
  timeToExpirationYears,
  riskFreeRate = 0.045,
  volatility = 0.2,
  optionType = 'PUT',
}) => {
  const S = Number(spotPrice);
  const K = Number(strikePrice);
  const T = Number(timeToExpirationYears);
  const r = Number(riskFreeRate);
  const sigma = Number(volatility);
  const type = optionType.toUpperCase();

  if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) {
    throw boom.badRequest('Parámetros numéricos inválidos para Black-Scholes (S, K, T y sigma deben ser > 0).');
  }

  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  let theoreticalPrice = 0;
  let delta = 0;

  if (type === 'CALL') {
    theoreticalPrice = S * standardNormalCDF(d1) - K * Math.exp(-r * T) * standardNormalCDF(d2);
    delta = standardNormalCDF(d1);
  } else if (type === 'PUT') {
    theoreticalPrice = K * Math.exp(-r * T) * standardNormalCDF(-d2) - S * standardNormalCDF(-d1);
    delta = standardNormalCDF(d1) - 1.0;
  } else {
    throw boom.badRequest('optionType debe ser CALL o PUT.');
  }

  // Griegas comunes
  const gamma = standardNormalPDF(d1) / (S * sigma * Math.sqrt(T));
  const vega = (S * standardNormalPDF(d1) * Math.sqrt(T)) / 100; // Por 1% de volatilidad

  let theta = 0;
  let rho = 0;

  if (type === 'CALL') {
    theta =
      (-((S * standardNormalPDF(d1) * sigma) / (2 * Math.sqrt(T))) -
        r * K * Math.exp(-r * T) * standardNormalCDF(d2)) /
      365;
    rho = (K * T * Math.exp(-r * T) * standardNormalCDF(d2)) / 100;
  } else {
    theta =
      (-((S * standardNormalPDF(d1) * sigma) / (2 * Math.sqrt(T))) +
        r * K * Math.exp(-r * T) * standardNormalCDF(-d2)) /
      365;
    rho = (-K * T * Math.exp(-r * T) * standardNormalCDF(-d2)) / 100;
  }

  return {
    spotPrice: S,
    strikePrice: K,
    timeToExpirationYears: T,
    riskFreeRate: r,
    volatility: sigma,
    optionType: type,
    theoreticalPrice: Number(theoreticalPrice.toFixed(4)),
    greeks: {
      delta: Number(delta.toFixed(4)),
      gamma: Number(gamma.toFixed(6)),
      theta: Number(theta.toFixed(4)),
      vega: Number(vega.toFixed(4)),
      rho: Number(rho.toFixed(4)),
    },
  };
};

// Aproximación numérica de Volatilidad Implícita con Newton-Raphson
export const calculateImpliedVolatility = ({
  marketPrice,
  spotPrice,
  strikePrice,
  timeToExpirationYears,
  riskFreeRate = 0.045,
  optionType = 'PUT',
  maxIterations = 100,
  tolerance = 1e-5,
}) => {
  let sigma = 0.3; // Semilla inicial razonable (30%)
  const targetPrice = Number(marketPrice);

  for (let i = 0; i < maxIterations; i++) {
    const bs = calculateBlackScholes({
      spotPrice,
      strikePrice,
      timeToExpirationYears,
      riskFreeRate,
      volatility: sigma,
      optionType,
    });

    const diff = bs.theoreticalPrice - targetPrice;
    if (Math.abs(diff) < tolerance) {
      return {
        impliedVolatility: Number(sigma.toFixed(4)),
        iterations: i + 1,
        converged: true,
        marketPrice: targetPrice,
      };
    }

    // Vega cruda sin dividir entre 100
    const rawVega = Number(spotPrice) * standardNormalPDF(
      (Math.log(Number(spotPrice) / Number(strikePrice)) + (riskFreeRate + 0.5 * sigma * sigma) * Number(timeToExpirationYears)) /
        (sigma * Math.sqrt(Number(timeToExpirationYears)))
    ) * Math.sqrt(Number(timeToExpirationYears));

    if (rawVega < 1e-12) break; // Evitar división entre cero
    sigma = sigma - diff / rawVega;
    if (sigma <= 0.001) sigma = 0.001; // Límite inferior
  }

  return {
    impliedVolatility: Number(sigma.toFixed(4)),
    iterations: maxIterations,
    converged: false,
    marketPrice: targetPrice,
  };
};

// Cálculo agregado de Griegas de portafolio para una estrategia completa
export const calculateStrategyGreeks = (strategy) => {
  const S = Number(strategy.underlying?.spotPriceAtEntry || 100);
  const shares = Number(strategy.underlying?.sharesCount || 100);
  const legs = strategy.legs || [];

  let totalDelta = 0;
  let totalGamma = 0;
  let totalVega = 0;
  let totalTheta = 0;
  let totalRho = 0;

  const legBreakdown = [];

  for (const leg of legs) {
    if (leg.assetType === 'EQUITY' || leg.legRole === 'UNDERLYING') {
      const equityDelta = 1.0;
      totalDelta += equityDelta;
      legBreakdown.push({
        legId: leg.legId,
        role: leg.legRole || 'UNDERLYING',
        assetType: 'EQUITY',
        greeks: { delta: equityDelta, gamma: 0, vega: 0, theta: 0, rho: 0 },
      });
    } else {
      const type = (leg.optionType || (leg.legRole === 'HEDGE_FLOOR' ? 'PUT' : 'CALL')).toUpperCase();
      const strike = Number(leg.strike || S);
      const isShort = leg.legRole === 'FINANCE_CEILING' || leg.side === 'SELL' || leg.side === 'SHORT';
      const multiplier = isShort ? -1 : 1;

      const bs = calculateBlackScholes({
        spotPrice: S,
        strikePrice: strike,
        timeToExpirationYears: 0.1,
        volatility: 0.25,
        optionType: type,
      });

      const legGreeks = {
        delta: Number((bs.greeks.delta * multiplier).toFixed(4)),
        gamma: Number((bs.greeks.gamma * multiplier).toFixed(6)),
        vega: Number((bs.greeks.vega * multiplier).toFixed(4)),
        theta: Number((bs.greeks.theta * multiplier).toFixed(4)),
        rho: Number((bs.greeks.rho * multiplier).toFixed(4)),
      };

      totalDelta += legGreeks.delta;
      totalGamma += legGreeks.gamma;
      totalVega += legGreeks.vega;
      totalTheta += legGreeks.theta;
      totalRho += legGreeks.rho;

      legBreakdown.push({
        legId: leg.legId,
        role: leg.legRole,
        assetType: 'OPTION',
        optionType: type,
        strike,
        side: isShort ? 'SHORT' : 'LONG',
        greeks: legGreeks,
      });
    }
  }

  return {
    strategyId: strategy._id || strategy.id,
    spotPrice: S,
    sharesCount: shares,
    aggregateGreeks: {
      netDelta: Number(totalDelta.toFixed(4)),
      netGamma: Number(totalGamma.toFixed(6)),
      netVega: Number(totalVega.toFixed(4)),
      netTheta: Number(totalTheta.toFixed(4)),
      netRho: Number(totalRho.toFixed(4)),
    },
    legs: legBreakdown,
    evaluatedAt: new Date().toISOString(),
  };
};

// Simulación cuantitativa de cobertura con prima neta F0 y precio futuro F2
export const simulateF0F2Hedging = (strategy, { futureSpotF2, daysElapsed = 30 } = {}) => {
  const F0 = Number(strategy.underlying?.spotPriceAtEntry || 100);
  const F2 = Number(futureSpotF2 !== undefined ? futureSpotF2 : F0);
  const shares = Number(strategy.underlying?.sharesCount || 100);

  const putLeg = (strategy.legs || []).find((l) => l.legRole === 'HEDGE_FLOOR' || l.role === 'LONG_PUT');
  const callLeg = (strategy.legs || []).find((l) => l.legRole === 'FINANCE_CEILING' || l.role === 'SHORT_CALL');

  const putStrike = putLeg ? Number(putLeg.strike) : F0 * 0.95;
  const putPremium = putLeg ? Number(putLeg.entryPrice || putLeg.premium || 2.5) : 0;

  const callStrike = callLeg ? Number(callLeg.strike) : F0 * 1.05;
  const callPremium = callLeg ? Number(callLeg.entryPrice || callLeg.premium || 2.8) : 0;

  const netPremiumDebitCredit = (callPremium - putPremium) * shares;

  // Rendimiento de la acción pura (sin cobertura)
  const unhedgedStockPL = (F2 - F0) * shares;
  const unhedgedReturnPct = Number((((F2 - F0) / F0) * 100).toFixed(2));

  // Ejercicio de piernas de opciones
  const putIntrinsic = Math.max(0, putStrike - F2);
  const putPayoff = (putIntrinsic - putPremium) * shares;

  const callIntrinsic = Math.max(0, F2 - callStrike);
  const callPayoff = (callPremium - callIntrinsic) * shares;

  // Payoff consolidado de la estrategia
  const strategyTotalPL = unhedgedStockPL + (putIntrinsic * shares) - (callIntrinsic * shares) + netPremiumDebitCredit;
  const strategyReturnPct = Number(((strategyTotalPL / (F0 * shares)) * 100).toFixed(2));

  const hedgeBenefitUSD = Number((strategyTotalPL - unhedgedStockPL).toFixed(2));

  return {
    strategyId: strategy._id || strategy.id,
    simulationParameters: {
      initialSpotF0: F0,
      futureSpotF2: F2,
      priceChangePct: Number((((F2 - F0) / F0) * 100).toFixed(2)),
      sharesCount: shares,
      daysElapsed,
    },
    optionsStructure: {
      putFloorStrike: putStrike,
      putPremium,
      callCeilingStrike: callStrike,
      callPremium,
      netPremiumCashflowUSD: Number(netPremiumDebitCredit.toFixed(2)),
    },
    comparativePayoff: {
      unhedgedPortfolio: {
        totalPLUSD: Number(unhedgedStockPL.toFixed(2)),
        returnPercent: unhedgedReturnPct,
      },
      hedgedStrategy: {
        totalPLUSD: Number(strategyTotalPL.toFixed(2)),
        returnPercent: strategyReturnPct,
        putPayoffUSD: Number(putPayoff.toFixed(2)),
        callPayoffUSD: Number(callPayoff.toFixed(2)),
      },
      protectionEffectivenessUSD: hedgeBenefitUSD,
      status:
        F2 < putStrike
          ? 'COBERTURA_ACTIVADA_PISO_PROTECTOR'
          : F2 > callStrike
          ? 'TECHO_ALCANZADO_GANANCIA_TOPADA'
          : 'ZONA_NEUTRAL_SANO_RENDIMIENTO',
    },
    simulatedAt: new Date().toISOString(),
  };
};


