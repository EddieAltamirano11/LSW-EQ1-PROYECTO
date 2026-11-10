import boom from '@hapi/boom';

// Aproximación de la Función de Distribución Normal Estándar Acumulada N(x)
export const calcularDistribucionNormalEstandarAcumulada = (x) => {
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
export const calcularDensidadNormalEstandar = (x) => {
  return (1.0 / Math.sqrt(2.0 * Math.PI)) * Math.exp(-0.5 * x * x);
};

// Valuación analítica Black-Scholes y cálculo de las 5 Griegas
export const valorarOpcionBlackScholes = ({
  spotPrice: precioSubyacente,
  strikePrice: precioEjercicio,
  timeToExpirationYears: tiempoAlVencimientoEnAnios,
  riskFreeRate: tasaLibreDeRiesgo = 0.045,
  volatility: volatilidad = 0.2,
  optionType: tipoOpcionEntrada = 'PUT',
}) => {
  const S = Number(precioSubyacente);
  const K = Number(precioEjercicio);
  const T = Number(tiempoAlVencimientoEnAnios);
  const r = Number(tasaLibreDeRiesgo);
  const sigma = Number(volatilidad);
  const tipoOpcion = tipoOpcionEntrada.toUpperCase();

  if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) {
    throw boom.badRequest('Parámetros numéricos inválidos para Black-Scholes (S, K, T y sigma deben ser > 0).');
  }

  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  let precioTeorico = 0;
  let delta = 0;

  if (tipoOpcion === 'CALL') {
    precioTeorico = S * calcularDistribucionNormalEstandarAcumulada(d1) -
      K * Math.exp(-r * T) * calcularDistribucionNormalEstandarAcumulada(d2);
    delta = calcularDistribucionNormalEstandarAcumulada(d1);
  } else if (tipoOpcion === 'PUT') {
    precioTeorico = K * Math.exp(-r * T) * calcularDistribucionNormalEstandarAcumulada(-d2) -
      S * calcularDistribucionNormalEstandarAcumulada(-d1);
    delta = calcularDistribucionNormalEstandarAcumulada(d1) - 1.0;
  } else {
    throw boom.badRequest('optionType debe ser CALL o PUT.');
  }

  // Griegas comunes
  const gamma = calcularDensidadNormalEstandar(d1) / (S * sigma * Math.sqrt(T));
  const vega = (S * calcularDensidadNormalEstandar(d1) * Math.sqrt(T)) / 100; // Por 1% de volatilidad

  let theta = 0;
  let rho = 0;

  if (tipoOpcion === 'CALL') {
    theta =
      (-((S * calcularDensidadNormalEstandar(d1) * sigma) / (2 * Math.sqrt(T))) -
        r * K * Math.exp(-r * T) * calcularDistribucionNormalEstandarAcumulada(d2)) /
      365;
    rho = (K * T * Math.exp(-r * T) * calcularDistribucionNormalEstandarAcumulada(d2)) / 100;
  } else {
    theta =
      (-((S * calcularDensidadNormalEstandar(d1) * sigma) / (2 * Math.sqrt(T))) +
        r * K * Math.exp(-r * T) * calcularDistribucionNormalEstandarAcumulada(-d2)) /
      365;
    rho = (-K * T * Math.exp(-r * T) * calcularDistribucionNormalEstandarAcumulada(-d2)) / 100;
  }

  return {
    spotPrice: S,
    strikePrice: K,
    timeToExpirationYears: T,
    riskFreeRate: r,
    volatility: sigma,
    optionType: tipoOpcion,
    theoreticalPrice: Number(precioTeorico.toFixed(4)),
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
export const calcularVolatilidadImplicita = ({
  marketPrice: precioMercado,
  spotPrice: precioSubyacente,
  strikePrice: precioEjercicio,
  timeToExpirationYears: tiempoAlVencimientoEnAnios,
  riskFreeRate: tasaLibreDeRiesgo = 0.045,
  optionType: tipoOpcion = 'PUT',
  maxIterations: maximoDeIteraciones = 100,
  tolerance: tolerancia = 1e-5,
}) => {
  let sigma = 0.3; // Semilla inicial razonable (30%)
  const precioObjetivo = Number(precioMercado);

  for (let iteracion = 0; iteracion < maximoDeIteraciones; iteracion++) {
    const valoracion = valorarOpcionBlackScholes({
      spotPrice: precioSubyacente,
      strikePrice: precioEjercicio,
      timeToExpirationYears: tiempoAlVencimientoEnAnios,
      riskFreeRate: tasaLibreDeRiesgo,
      volatility: sigma,
      optionType: tipoOpcion,
    });

    const diferenciaPrecio = valoracion.theoreticalPrice - precioObjetivo;
    if (Math.abs(diferenciaPrecio) < tolerancia) {
      return {
        impliedVolatility: Number(sigma.toFixed(4)),
        iterations: iteracion + 1,
        converged: true,
        marketPrice: precioObjetivo,
      };
    }

    // Vega cruda sin dividir entre 100
    const vegaSinEscalar = Number(precioSubyacente) * calcularDensidadNormalEstandar(
      (Math.log(Number(precioSubyacente) / Number(precioEjercicio)) +
        (tasaLibreDeRiesgo + 0.5 * sigma * sigma) * Number(tiempoAlVencimientoEnAnios)) /
        (sigma * Math.sqrt(Number(tiempoAlVencimientoEnAnios)))
    ) * Math.sqrt(Number(tiempoAlVencimientoEnAnios));

    if (vegaSinEscalar < 1e-12) break; // Evitar división entre cero
    sigma = sigma - diferenciaPrecio / vegaSinEscalar;
    if (sigma <= 0.001) sigma = 0.001; // Límite inferior
  }

  return {
    impliedVolatility: Number(sigma.toFixed(4)),
    iterations: maximoDeIteraciones,
    converged: false,
    marketPrice: precioObjetivo,
  };
};

// Cálculo agregado de Griegas de portafolio para una estrategia completa
export const calcularGriegasEstrategia = (estrategia) => {
  const S = Number(estrategia.underlying?.spotPriceAtEntry || 100);
  const cantidadAcciones = Number(estrategia.underlying?.sharesCount || 100);
  const piernas = estrategia.legs || [];

  let totalDelta = 0;
  let totalGamma = 0;
  let totalVega = 0;
  let totalTheta = 0;
  let totalRho = 0;

  const desglosePiernas = [];

  for (const pierna of piernas) {
    if (pierna.assetType === 'EQUITY' || pierna.legRole === 'UNDERLYING') {
      const deltaAccion = 1.0;
      totalDelta += deltaAccion;
      desglosePiernas.push({
        legId: pierna.legId,
        role: pierna.legRole || 'UNDERLYING',
        assetType: 'EQUITY',
        greeks: { delta: deltaAccion, gamma: 0, vega: 0, theta: 0, rho: 0 },
      });
    } else {
      const tipoOpcion = (pierna.optionType || (pierna.legRole === 'HEDGE_FLOOR' ? 'PUT' : 'CALL')).toUpperCase();
      const precioEjercicio = Number(pierna.strike || S);
      const esPosicionCorta = pierna.legRole === 'FINANCE_CEILING' || pierna.side === 'SELL' || pierna.side === 'SHORT';
      const multiplicador = esPosicionCorta ? -1 : 1;

      const valoracion = valorarOpcionBlackScholes({
        spotPrice: S,
        strikePrice: precioEjercicio,
        timeToExpirationYears: 0.1,
        volatility: 0.25,
        optionType: tipoOpcion,
      });

      const griegasPierna = {
        delta: Number((valoracion.greeks.delta * multiplicador).toFixed(4)),
        gamma: Number((valoracion.greeks.gamma * multiplicador).toFixed(6)),
        vega: Number((valoracion.greeks.vega * multiplicador).toFixed(4)),
        theta: Number((valoracion.greeks.theta * multiplicador).toFixed(4)),
        rho: Number((valoracion.greeks.rho * multiplicador).toFixed(4)),
      };

      totalDelta += griegasPierna.delta;
      totalGamma += griegasPierna.gamma;
      totalVega += griegasPierna.vega;
      totalTheta += griegasPierna.theta;
      totalRho += griegasPierna.rho;

      desglosePiernas.push({
        legId: pierna.legId,
        role: pierna.legRole,
        assetType: 'OPTION',
        optionType: tipoOpcion,
        strike: precioEjercicio,
        side: esPosicionCorta ? 'SHORT' : 'LONG',
        greeks: griegasPierna,
      });
    }
  }

  return {
    strategyId: estrategia._id || estrategia.id,
    spotPrice: S,
    sharesCount: cantidadAcciones,
    aggregateGreeks: {
      netDelta: Number(totalDelta.toFixed(4)),
      netGamma: Number(totalGamma.toFixed(6)),
      netVega: Number(totalVega.toFixed(4)),
      netTheta: Number(totalTheta.toFixed(4)),
      netRho: Number(totalRho.toFixed(4)),
    },
    legs: desglosePiernas,
    evaluatedAt: new Date().toISOString(),
  };
};

// Simulación cuantitativa de cobertura con prima neta F0 y precio futuro F2
export const simularCoberturaF0F2 = (
  estrategia,
  { futureSpotF2: precioFuturoF2, daysElapsed: diasTranscurridos = 30 } = {}
) => {
  const F0 = Number(estrategia.underlying?.spotPriceAtEntry || 100);
  const F2 = Number(precioFuturoF2 !== undefined ? precioFuturoF2 : F0);
  const cantidadAcciones = Number(estrategia.underlying?.sharesCount || 100);

  const piernaPut = (estrategia.legs || []).find(
    (pierna) => pierna.legRole === 'HEDGE_FLOOR' || pierna.role === 'LONG_PUT'
  );
  const piernaCall = (estrategia.legs || []).find(
    (pierna) => pierna.legRole === 'FINANCE_CEILING' || pierna.role === 'SHORT_CALL'
  );

  const precioEjercicioPut = piernaPut ? Number(piernaPut.strike) : F0 * 0.95;
  const primaPut = piernaPut ? Number(piernaPut.entryPrice || piernaPut.premium || 2.5) : 0;

  const precioEjercicioCall = piernaCall ? Number(piernaCall.strike) : F0 * 1.05;
  const primaCall = piernaCall ? Number(piernaCall.entryPrice || piernaCall.premium || 2.8) : 0;

  const flujoNetoPrimas = (primaCall - primaPut) * cantidadAcciones;

  // Rendimiento de la acción pura (sin cobertura)
  const resultadoSinCobertura = (F2 - F0) * cantidadAcciones;
  const rendimientoSinCoberturaPorcentual = Number((((F2 - F0) / F0) * 100).toFixed(2));

  // Ejercicio de piernas de opciones
  const valorIntrinsecoPut = Math.max(0, precioEjercicioPut - F2);
  const resultadoPut = (valorIntrinsecoPut - primaPut) * cantidadAcciones;

  const valorIntrinsecoCall = Math.max(0, F2 - precioEjercicioCall);
  const resultadoCall = (primaCall - valorIntrinsecoCall) * cantidadAcciones;

  // Ganancia o pérdida total de la estrategia
  const resultadoTotalEstrategia = resultadoSinCobertura + (valorIntrinsecoPut * cantidadAcciones) -
    (valorIntrinsecoCall * cantidadAcciones) + flujoNetoPrimas;
  const rendimientoEstrategiaPorcentual = Number(((resultadoTotalEstrategia / (F0 * cantidadAcciones)) * 100).toFixed(2));

  const efectoCobertura = Number((resultadoTotalEstrategia - resultadoSinCobertura).toFixed(2));

  return {
    strategyId: estrategia._id || estrategia.id,
    simulationParameters: {
      initialSpotF0: F0,
      futureSpotF2: F2,
      priceChangePct: Number((((F2 - F0) / F0) * 100).toFixed(2)),
      sharesCount: cantidadAcciones,
      daysElapsed: diasTranscurridos,
    },
    optionsStructure: {
      putFloorStrike: precioEjercicioPut,
      putPremium: primaPut,
      callCeilingStrike: precioEjercicioCall,
      callPremium: primaCall,
      netPremiumCashflowUSD: Number(flujoNetoPrimas.toFixed(2)),
    },
    comparativePayoff: {
      unhedgedPortfolio: {
        totalPLUSD: Number(resultadoSinCobertura.toFixed(2)),
        returnPercent: rendimientoSinCoberturaPorcentual,
      },
      hedgedStrategy: {
        totalPLUSD: Number(resultadoTotalEstrategia.toFixed(2)),
        returnPercent: rendimientoEstrategiaPorcentual,
        putPayoffUSD: Number(resultadoPut.toFixed(2)),
        callPayoffUSD: Number(resultadoCall.toFixed(2)),
      },
      protectionEffectivenessUSD: efectoCobertura,
      status:
        F2 < precioEjercicioPut
          ? 'COBERTURA_ACTIVADA_PISO_PROTECTOR'
          : F2 > precioEjercicioCall
          ? 'TECHO_ALCANZADO_GANANCIA_TOPADA'
          : 'ZONA_NEUTRAL_SANO_RENDIMIENTO',
    },
    simulatedAt: new Date().toISOString(),
  };
};

// Alias para los módulos que importan los nombres originales.
export {
  calcularDistribucionNormalEstandarAcumulada as standardNormalCDF,
  calcularDensidadNormalEstandar as standardNormalPDF,
  valorarOpcionBlackScholes as calculateBlackScholes,
  calcularVolatilidadImplicita as calculateImpliedVolatility,
  calcularGriegasEstrategia as calculateStrategyGreeks,
  simularCoberturaF0F2 as simulateF0F2Hedging,
};


