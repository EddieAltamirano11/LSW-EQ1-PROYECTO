import boom from '@hapi/boom';
import { standardNormalCDF, calculateBlackScholes } from '../../v1/services/quant.service.js';
import * as BrokerService from '../../v1/services/broker.service.js';
import config from '../../../config/config.js';

// Canasta institucional de alta liquidez en acciones y ETFs del S&P 500 y Nasdaq-100
export const MARKET_BASKET = [
  {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    exchange: 'NASDAQ',
    tvSymbol: 'NASDAQ:AAPL',
    sector: 'Tecnología de Consumo',
    beta: 1.05,
    dividendYield: 0.52,
    baseVolatility: 0.22,
    referenceSpot: 227.50,
    rsi14: 58.4,
    aboveSma200: true,
  },
  {
    symbol: 'MSFT',
    companyName: 'Microsoft Corporation',
    exchange: 'NASDAQ',
    tvSymbol: 'NASDAQ:MSFT',
    sector: 'Cloud & Software Empresarial',
    beta: 1.15,
    dividendYield: 0.72,
    baseVolatility: 0.24,
    referenceSpot: 420.25,
    rsi14: 61.2,
    aboveSma200: true,
  },
  {
    symbol: 'NVDA',
    companyName: 'NVIDIA Corporation',
    exchange: 'NASDAQ',
    tvSymbol: 'NASDAQ:NVDA',
    sector: 'Semiconductores & Computación IA',
    beta: 1.68,
    dividendYield: 0.08,
    baseVolatility: 0.46,
    referenceSpot: 141.80,
    rsi14: 64.8,
    aboveSma200: true,
  },
  {
    symbol: 'GOOGL',
    companyName: 'Alphabet Inc.',
    exchange: 'NASDAQ',
    tvSymbol: 'NASDAQ:GOOGL',
    sector: 'Servicios de Comunicación & IA',
    beta: 1.08,
    dividendYield: 0.48,
    baseVolatility: 0.26,
    referenceSpot: 178.60,
    rsi14: 53.1,
    aboveSma200: true,
  },
  {
    symbol: 'AMZN',
    companyName: 'Amazon.com Inc.',
    exchange: 'NASDAQ',
    tvSymbol: 'NASDAQ:AMZN',
    sector: 'Comercio Electrónico & AWS Cloud',
    beta: 1.22,
    dividendYield: 0.00,
    baseVolatility: 0.29,
    referenceSpot: 206.40,
    rsi14: 59.7,
    aboveSma200: true,
  },
  {
    symbol: 'META',
    companyName: 'Meta Platforms Inc.',
    exchange: 'NASDAQ',
    tvSymbol: 'NASDAQ:META',
    sector: 'Medios Interactivos & Metaverso',
    beta: 1.32,
    dividendYield: 0.34,
    baseVolatility: 0.33,
    referenceSpot: 585.10,
    rsi14: 62.9,
    aboveSma200: true,
  },
  {
    symbol: 'TSLA',
    companyName: 'Tesla Inc.',
    exchange: 'NASDAQ',
    tvSymbol: 'NASDAQ:TSLA',
    sector: 'Vehículos Eléctricos & Robótica',
    beta: 2.12,
    dividendYield: 0.00,
    baseVolatility: 0.54,
    referenceSpot: 248.90,
    rsi14: 49.2,
    aboveSma200: false,
  },
  {
    symbol: 'AMD',
    companyName: 'Advanced Micro Devices, Inc.',
    exchange: 'NASDAQ',
    tvSymbol: 'NASDAQ:AMD',
    sector: 'Procesadores & Aceleradores IA',
    beta: 1.58,
    dividendYield: 0.00,
    baseVolatility: 0.42,
    referenceSpot: 147.30,
    rsi14: 54.8,
    aboveSma200: true,
  },
  {
    symbol: 'SPY',
    companyName: 'SPDR S&P 500 ETF Trust',
    exchange: 'AMEX',
    tvSymbol: 'AMEX:SPY',
    sector: 'Índice de Mercado Amplio (Benchmark)',
    beta: 1.00,
    dividendYield: 1.28,
    baseVolatility: 0.14,
    referenceSpot: 595.40,
    rsi14: 56.6,
    aboveSma200: true,
  },
  {
    symbol: 'QQQ',
    companyName: 'Invesco QQQ Trust (Nasdaq-100)',
    exchange: 'NASDAQ',
    tvSymbol: 'NASDAQ:QQQ',
    sector: 'Índice Tecnológico Líder',
    beta: 1.18,
    dividendYield: 0.58,
    baseVolatility: 0.18,
    referenceSpot: 512.20,
    rsi14: 58.1,
    aboveSma200: true,
  },
];

/**
 * Calcula la fecha de expiración estándar para un horizonte en días dado (DTE)
 * Regla de Oro: Siempre se alinea al primer viernes hábil posterior a la cantidad de días seleccionados,
 * incorporando salvaguarda para feriados bursátiles de Wall Street (CBOE/NYSE).
 */
export const calculateTargetExpiration = (days = 45, refDate = new Date()) => {
  const target = new Date(refDate.getTime() + days * 86400000);
  const dayOfWeek = target.getUTCDay(); // 0=Domingo, 1=Lunes, ..., 5=Viernes, 6=Sábado
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  let chosenDate = new Date(target.getTime() + daysUntilFriday * 86400000);

  // Salvaguarda de feriados bursátiles CBOE/NYSE (mercado cerrado en Navidad/Año Nuevo)
  const month = chosenDate.getUTCMonth(); // 11 = Diciembre, 0 = Enero
  const date = chosenDate.getUTCDate();

  if (month === 11 && date === 25) {
    // 25 de diciembre: adelantar al 18 de diciembre (3er viernes mensual con máxima liquidez)
    chosenDate = new Date(Date.UTC(chosenDate.getUTCFullYear(), 11, 18));
  } else if (month === 0 && date === 1) {
    // 1 de enero: adelantar al 31 de diciembre
    chosenDate = new Date(Date.UTC(chosenDate.getUTCFullYear() - 1, 11, 31));
  }

  const yyyy = chosenDate.getUTCFullYear();
  const mm = String(chosenDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(chosenDate.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Cache en memoria para cotizaciones del scanner con TTL de 60 segundos
const quoteCache = new Map();

/**
 * Obtiene el precio spot con timeout de 600ms y caché en memoria para máxima velocidad
 */
export const getCachedOrBrokerSpot = async (symbol, broker, referenceSpot) => {
  // En modo de pruebas unitarias o simulación, responder inmediatamente con el precio de referencia
  if (process.env.NODE_ENV === 'test' || broker === 'SIMULATED') {
    return referenceSpot;
  }

  const cacheKey = `${symbol}_${broker}`;
  const cached = quoteCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.price;
  }

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Broker quote timeout')), 600)
    );
    const quotePromise = BrokerService.getBrokerQuote(symbol, broker);
    const quote = await Promise.race([quotePromise, timeoutPromise]);
    if (quote && quote.lastPrice && Number(quote.lastPrice) > 0) {
      const price = Number(quote.lastPrice);
      quoteCache.set(cacheKey, { price, timestamp: Date.now() });
      return price;
    }
  } catch (_) {
    // Si el broker está desconectado o excede 600ms, utilizar referencia calibrada de forma transparente
  }

  return referenceSpot;
};

/**
 * Escanea la canasta institucional y genera el ranking cuantitativo
 */
export const scanTopCollars = async (options = {}) => {
  const {
    limit = 5,
    sortBy = 'probability',
    dteHorizon = 45,
    broker = config.DEFAULT_BROKER || 'WEBULL',
  } = options;

  const validLimits = Number(limit);
  if (isNaN(validLimits) || validLimits < 1 || validLimits > 10) {
    throw boom.badRequest("El parámetro 'limit' debe ser un número entero entre 1 y 10.");
  }

  const validSorts = ['probability', 'netCredit', 'maxReturn'];
  if (!validSorts.includes(sortBy)) {
    throw boom.badRequest(`El parámetro 'sortBy' debe ser uno de: ${validSorts.join(', ')}.`);
  }

  const validDte = Number(dteHorizon);
  if (![30, 45, 60].includes(validDte)) {
    throw boom.badRequest("El parámetro 'dteHorizon' debe ser un horizonte estándar en días: 30, 45 o 60.");
  }

  const targetExpiration = calculateTargetExpiration(validDte);
  const timeToExpirationYears = Number((validDte / 365).toFixed(4));
  const r = 0.045; // Tasa libre de riesgo federal de referencia (4.5%)

  const evaluatedCandidates = await Promise.all(
    MARKET_BASKET.map(async (asset) => {
      const S = await getCachedOrBrokerSpot(asset.symbol, broker, asset.referenceSpot);
      const vol = asset.baseVolatility;

      // 1. Calibración de Strikes OTM para Collar Spread
      // Put Protector (Piso): ~5% por debajo del spot
      const rawPutStrike = S * 0.95;
      const putStrike = S > 200 ? Math.round(rawPutStrike / 5) * 5 : Math.round(rawPutStrike);

      // Call de Financiamiento (Techo): ~5% por encima del spot
      const rawCallStrike = S * 1.05;
      const callStrike = S > 200 ? Math.round(rawCallStrike / 5) * 5 : Math.round(rawCallStrike);

      // 2. Valuación teórica con Black-Scholes
      const putBS = calculateBlackScholes({
        spotPrice: S,
        strikePrice: putStrike,
        timeToExpirationYears,
        volatility: vol,
        riskFreeRate: r,
        optionType: 'PUT',
      });

      const callBS = calculateBlackScholes({
        spotPrice: S,
        strikePrice: callStrike,
        timeToExpirationYears,
        volatility: vol,
        riskFreeRate: r,
        optionType: 'CALL',
      });

      // Primas de mercado estimadas con spread realista
      const putMarketPremium = Number((putBS.theoreticalPrice * 1.02).toFixed(2));
      const callMarketPremium = Number((callBS.theoreticalPrice * 0.98).toFixed(2));

      // Flujo neto de primas por acción (Venta de Call - Compra de Put)
      const netDebitCredit = Number((callMarketPremium - putMarketPremium).toFixed(2));
      const netCreditUSD = Number((netDebitCredit * 100).toFixed(2));

      // 3. Métricas Financieras del Collar
      const maxLossPerShare = Number((S - putStrike - netDebitCredit).toFixed(2));
      const maxLossTotalUSD = Number((maxLossPerShare * 100).toFixed(2));
      const maxProfitPerShare = Number((callStrike - S + netDebitCredit).toFixed(2));
      const maxProfitUSD = Number((maxProfitPerShare * 100).toFixed(2));
      const maxReturnPct = Number(((maxProfitUSD / (S * 100)) * 100).toFixed(2));
      const breakevenPrice = Number((S - netDebitCredit).toFixed(2));

      // 4. Estimación de Probabilidades Estocásticas (Black-Scholes d2)
      // d2(K) = [ln(S/K) + (r - 0.5*sigma^2)*T] / (sigma * sqrt(T))
      const d1Put = (Math.log(S / putStrike) + (r + 0.5 * vol * vol) * timeToExpirationYears) / (vol * Math.sqrt(timeToExpirationYears));
      const d2Put = d1Put - vol * Math.sqrt(timeToExpirationYears);

      const d1Call = (Math.log(S / callStrike) + (r + 0.5 * vol * vol) * timeToExpirationYears) / (vol * Math.sqrt(timeToExpirationYears));
      const d2Call = d1Call - vol * Math.sqrt(timeToExpirationYears);

      // Probabilidad de que el precio termine por encima del strike del Put (No tocar el piso de pérdida máxima)
      const floorProtectionPct = Number((standardNormalCDF(d2Put) * 100).toFixed(1));

      // Probabilidad de ser asignado en la Call (precio termina por encima del strike Call)
      const assignmentRiskPct = Number((standardNormalCDF(d2Call) * 100).toFixed(1));

      // Probabilidad de expirar en el rango dulce (entre piso y techo, conservando acciones y primas)
      const sweetSpotPct = Number(Math.max(0, standardNormalCDF(d2Put) - standardNormalCDF(d2Call)) * 100).toFixed(1);

      // Probabilidad de ganar dinero (precio termina arriba del Breakeven)
      const d1Be = (Math.log(S / breakevenPrice) + (r + 0.5 * vol * vol) * timeToExpirationYears) / (vol * Math.sqrt(timeToExpirationYears));
      const d2Be = d1Be - vol * Math.sqrt(timeToExpirationYears);
      const winRatePct = Number((standardNormalCDF(d2Be) * 100).toFixed(1));

      // 5. Diagnóstico de Tendencia Técnica
      let technicalOutlook = 'NEUTRAL';
      let technicalSummary = 'Consolidación lateral con baja volatilidad direccional.';
      if (asset.aboveSma200 && asset.rsi14 >= 55) {
        technicalOutlook = 'BULLISH';
        technicalSummary = `Tendencia alcista estructural confirmada por encima de SMA 200 y momentum saludable (RSI 14 = ${asset.rsi14}).`;
      } else if (asset.aboveSma200 && asset.rsi14 >= 48) {
        technicalOutlook = 'NEUTRAL_BULLISH';
        technicalSummary = `Soporte técnico respetado en SMA 200 con consolidación previa a nuevo impulso (RSI 14 = ${asset.rsi14}).`;
      }

      return {
        symbol: asset.symbol,
        companyName: asset.companyName,
        exchange: asset.exchange,
        sector: asset.sector,
        spotPrice: S,
        tradingViewSymbol: asset.tvSymbol,
        technicalOutlook,
        technicalSummary,
        rsi14: asset.rsi14,
        aboveSma200: asset.aboveSma200,
        beta: asset.beta,
        dividendYield: asset.dividendYield,
        volatility: vol,
        optimalExpiration: targetExpiration,
        dteDays: validDte,
        putFloor: {
          strike: putStrike,
          marketPremium: putMarketPremium,
          theoreticalPriceBS: putBS.theoreticalPrice,
          delta: putBS.greeks.delta,
          moneyness: `${(((S - putStrike) / S) * 100).toFixed(1)}% OTM`,
          role: 'Póliza de Seguro Protector (Floor)',
        },
        callCeiling: {
          strike: callStrike,
          marketPremium: callMarketPremium,
          theoreticalPriceBS: callBS.theoreticalPrice,
          delta: callBS.greeks.delta,
          moneyness: `${(((callStrike - S) / S) * 100).toFixed(1)}% OTM`,
          role: 'Techo de Ganancia y Financiamiento (Ceiling)',
        },
        financialMetrics: {
          netDebitCredit,
          netCreditTotalUSD: netCreditUSD,
          cashFlowType: netDebitCredit >= 0 ? 'CRÉDITO NETO (Pagan al Inversionista)' : 'DÉBITO MÍNIMO (Costo Casi Cero)',
          breakevenPrice,
          maxLossTotalUSD,
          maxProfitUSD,
          maxReturnPct,
        },
        probabilities: {
          floorProtectionPct: Number(floorProtectionPct),
          sweetSpotPct: Number(sweetSpotPct),
          assignmentRiskPct: Number(assignmentRiskPct),
          winRatePct: Number(winRatePct),
        },
      };
    })
  );

  // 6. Ordenamiento multi-criterio según requerimiento
  if (sortBy === 'probability') {
    evaluatedCandidates.sort((a, b) => b.probabilities.floorProtectionPct - a.probabilities.floorProtectionPct);
  } else if (sortBy === 'netCredit') {
    evaluatedCandidates.sort((a, b) => b.financialMetrics.netDebitCredit - a.financialMetrics.netDebitCredit);
  } else if (sortBy === 'maxReturn') {
    evaluatedCandidates.sort((a, b) => b.financialMetrics.maxReturnPct - a.financialMetrics.maxReturnPct);
  }

  // 7. Asignar Ranking correlativo y limitar al tamaño solicitado
  const rankedCandidates = evaluatedCandidates.slice(0, validLimits).map((item, idx) => ({
    rank: idx + 1,
    ...item,
  }));

  return {
    timestamp: new Date().toISOString(),
    criteria: {
      limit: validLimits,
      sortBy,
      dteHorizon: validDte,
      targetExpiration,
      broker: broker.toUpperCase(),
      totalScanned: MARKET_BASKET.length,
    },
    candidates: rankedCandidates,
  };
};

/**
 * Retorna los Criterios Cuantitativos y Técnicos oficiales para seleccionar una empresa
 */
export const getCompanyCriteria = () => {
  return {
    strategyName: 'Collar Spread (Zero-Cost Protective Collar)',
    targetProfile: 'Inversionista tenedor de acciones que desea asegurar ganancias o proteger capital sin pagar primas.',
    selectionPillars: [
      {
        pillarId: 'P01_TENDENCIA_TECNICA',
        title: 'Tendencia Alcista o Neutral con Sesgo Alcista Confirmada',
        threshold: 'Precio Spot > Media Móvil Simple de 200 días (SMA 200) y RSI (14) entre 45 y 65 puntos.',
        rationale:
          'El Collar limita la ganancia a cambio del seguro. Si la acción está en caída libre o bajista severa, el seguro se activará pero no habrá financiamiento atractivo. Se buscan activos con soporte técnico sólido donde el strike del Put coincida con un nivel de soporte y el Call con una resistencia.',
      },
      {
        pillarId: 'P02_LIQUIDEZ_DERIVADOS',
        title: 'Alta Liquidez en el Libro de Opciones (Penny Pilot Program)',
        threshold: 'Open Interest > 1,000 contratos en el strike objetivo y spread Bid-Ask menor a $0.10 USD.',
        rationale:
          'Las opciones sin volumen sufren deslizamiento de precios (slippage). Se requiere que el creador de mercado cotice con horquilla estrecha para que la venta de la Call financie efectivamente el 100% de la Put.',
      },
      {
        pillarId: 'P03_VOLATILIDAD_MODERADA',
        title: 'Volatilidad Implícita (IV) y Beta Controlados',
        threshold: 'Volatilidad entre 18% y 45% anualizada; Beta entre 0.90 y 1.70.',
        rationale:
          'Una volatilidad muy baja no paga suficiente prima en la Call para financiar la Put. Una volatilidad desmedida (> 70%, como en biotecnológicas o memecoins) eleva drásticamente el riesgo de que la acción salte violentamente y se pierda el activo.',
      },
      {
        pillarId: 'P04_CALENDARIO_CORPORATIVO',
        title: 'Ausencia de Reportes de Ganancias (Earnings) Inmediatos',
        threshold: 'Sin reporte trimestral de resultados en los próximos 15 a 30 días.',
        rationale:
          'Los reportes de ganancias introducen un evento binario con riesgo de brecha de precio (gap risk) y colapso de volatilidad (IV crush) que descalibra la simetría del collar.',
      },
    ],
  };
};

/**
 * Retorna la configuración para incrustar el gráfico y widget de TradingView
 */
export const getTradingViewConfig = (symbol) => {
  const cleanSym = String(symbol || 'AAPL').toUpperCase().trim();
  const matched = MARKET_BASKET.find((a) => a.symbol === cleanSym);
  const tvSymbol = matched ? matched.tvSymbol : `NASDAQ:${cleanSym}`;

  return {
    symbol: cleanSym,
    tvSymbol,
    chartConfig: {
      autosize: true,
      symbol: tvSymbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'es',
      enable_publishing: false,
      allow_symbol_change: true,
      studies: ['STD;SMA', 'STD;RSI'],
    },
    technicalAnalysisConfig: {
      interval: '1D',
      width: '100%',
      isTransparent: false,
      height: '450',
      symbol: tvSymbol,
      showIntervalTabs: true,
      displayMode: 'single',
      locale: 'es',
      colorTheme: 'dark',
    },
  };
};
