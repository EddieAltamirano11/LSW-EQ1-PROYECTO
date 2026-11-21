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

const TASA_LIBRE_RIESGO = 0.045; // Tasa libre de riesgo de referencia del modelo (4.5 %)
const VOLATILIDAD_DECLARADA = 0.28;
const ORIGEN_VOLATILIDAD_CANASTA = 'Volatilidad de referencia de la canasta (MARKET_BASKET.baseVolatility), no observada';
const ORIGEN_VOLATILIDAD_DECLARADA = 'Valor declarado para tickers añadidos (0.28), no observado';

/**
 * Escáner de collars teóricos (Black-Scholes) sobre la canasta. El precio de cada activo viene del broker:
 * sin cotización válida el activo va a `unavailable`; no hay precios de referencia ni precios fijos.
 * `cotizar` es inyectable para las pruebas; la caché de 60 s solo guarda cotizaciones válidas.
 */
export function crearEscaner({ cotizar = BrokerService.getBrokerQuote, limiteMs = 3000 } = {}) {
  const cache = new Map();

  async function cotizacionValida(simbolo, broker) {
    const clave = `${simbolo}_${broker}`;
    const guardada = cache.get(clave);
    if (guardada && Date.now() - guardada.momento < 60_000) return guardada.cotizacion;
    let temporizador;
    const limite = new Promise((_, rechazar) => {
      temporizador = setTimeout(() => rechazar(new Error(`El broker no cotizó ${simbolo} en ${limiteMs} ms`)), limiteMs);
    });
    try {
      const quote = await Promise.race([cotizar(simbolo, broker), limite]);
      const precio = Number(quote?.lastPrice);
      if (!(precio > 0)) throw new Error(`El broker no entregó un precio válido para ${simbolo}`);
      const cotizacion = {
        price: precio,
        companyName: quote.companyName ?? null,
        observedAt: quote.timestamp ?? null,
        source: quote.source ?? null,
      };
      cache.set(clave, { cotizacion, momento: Date.now() });
      return cotizacion;
    } finally {
      clearTimeout(temporizador);
    }
  }

  return async function scanTopCollars(options = {}) {
    const {
      limit = 5,
      sortBy = 'probability',
      dteHorizon = 45,
      broker = config.DEFAULT_BROKER || 'WEBULL',
      extraSymbols = '',
    } = options;

    const validLimits = Number(limit);
    if (!Number.isInteger(validLimits) || validLimits < 1 || validLimits > 25) {
      throw boom.badRequest("El parámetro 'limit' debe ser un número entero entre 1 y 25.");
    }

    const validSorts = ['probability', 'netCredit', 'maxReturn', 'cores'];
    if (!validSorts.includes(sortBy)) {
      throw boom.badRequest(`El parámetro 'sortBy' debe ser uno de: ${validSorts.join(', ')}.`);
    }

    const validDte = Number(dteHorizon);
    if (![30, 45, 60].includes(validDte)) {
      throw boom.badRequest("El parámetro 'dteHorizon' debe ser un horizonte estándar en días: 30, 45 o 60.");
    }

    const targetExpiration = calculateTargetExpiration(validDte);
    const timeToExpirationYears = Number((validDte / 365).toFixed(4));
    const r = TASA_LIBRE_RIESGO;
    const corredor = String(broker).toUpperCase();

    const extraList = typeof extraSymbols === 'string'
      ? extraSymbols.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : Array.isArray(extraSymbols) ? extraSymbols.map((s) => String(s).toUpperCase()) : [];
    const existingSymbols = new Set(MARKET_BASKET.map((a) => a.symbol.toUpperCase()));
    const newExtraSymbols = [...new Set(extraList.filter((s) => !existingSymbols.has(s)))];

    const fullBasket = [
      ...MARKET_BASKET.map((asset) => ({ ...asset, volatilitySource: ORIGEN_VOLATILIDAD_CANASTA })),
      ...newExtraSymbols.map((sym) => ({
        symbol: sym, companyName: null, exchange: null, tvSymbol: `NASDAQ:${sym}`, sector: null,
        beta: null, dividendYield: null, baseVolatility: VOLATILIDAD_DECLARADA, volatilitySource: ORIGEN_VOLATILIDAD_DECLARADA,
        isCustom: true,
      })),
    ];

    const unavailable = [];
    const cotizados = await Promise.all(fullBasket.map(async (asset) => {
      try {
        return { asset, cotizacion: await cotizacionValida(asset.symbol, corredor) };
      } catch (error) {
        unavailable.push({ symbol: asset.symbol, reason: error.message });
        return null;
      }
    }));
    const conPrecio = cotizados.filter(Boolean);
    if (!conPrecio.length) {
      throw boom.serverUnavailable(`${corredor} no entregó la cotización de ningún activo; no se usan precios de referencia. Ejemplo: ${unavailable[0]?.reason ?? 'sin detalle'}.`);
    }

    const evaluatedCandidates = conPrecio.map(({ asset, cotizacion }) => {
      const S = cotizacion.price;
      const vol = asset.baseVolatility;

      // 1. Strikes teóricos para Collar Spread: ~5 % por debajo y por encima del precio observado.
      const rawPutStrike = S * 0.95;
      const putStrike = S > 200 ? Math.round(rawPutStrike / 5) * 5 : Math.round(rawPutStrike);
      const rawCallStrike = S * 1.05;
      const callStrike = S > 200 ? Math.round(rawCallStrike / 5) * 5 : Math.round(rawCallStrike);

      // 2. Valuación teórica con Black-Scholes (no son cotizaciones de mercado ni precios de órdenes).
      const putBS = calculateBlackScholes({ spotPrice: S, strikePrice: putStrike, timeToExpirationYears, volatility: vol, riskFreeRate: r, optionType: 'PUT' });
      const callBS = calculateBlackScholes({ spotPrice: S, strikePrice: callStrike, timeToExpirationYears, volatility: vol, riskFreeRate: r, optionType: 'CALL' });
      const putTheoretical = Number(putBS.theoreticalPrice.toFixed(2));
      const callTheoretical = Number(callBS.theoreticalPrice.toFixed(2));

      // Flujo neto teórico por acción (Call − Put): positivo es crédito.
      const netDebitCredit = Number((callTheoretical - putTheoretical).toFixed(2));
      const netCreditUSD = Number((netDebitCredit * 100).toFixed(2));

      // 3. Métricas teóricas del collar
      const maxLossPerShare = Number((S - putStrike - netDebitCredit).toFixed(2));
      const maxLossTotalUSD = Number((maxLossPerShare * 100).toFixed(2));
      const maxProfitPerShare = Number((callStrike - S + netDebitCredit).toFixed(2));
      const maxProfitUSD = Number((maxProfitPerShare * 100).toFixed(2));
      const maxReturnPct = Number(((maxProfitUSD / (S * 100)) * 100).toFixed(2));
      const breakevenPrice = Number((S - netDebitCredit).toFixed(2));

      // 4. Probabilidades teóricas (Black-Scholes d2) con la volatilidad supuesta.
      const d2 = (K) => (Math.log(S / K) + (r - 0.5 * vol * vol) * timeToExpirationYears) / (vol * Math.sqrt(timeToExpirationYears));
      const floorProtectionPct = Number((standardNormalCDF(d2(putStrike)) * 100).toFixed(1));
      const assignmentRiskPct = Number((standardNormalCDF(d2(callStrike)) * 100).toFixed(1));
      const sweetSpotPct = Number((Math.max(0, standardNormalCDF(d2(putStrike)) - standardNormalCDF(d2(callStrike))) * 100).toFixed(1));
      const winRatePct = Number((standardNormalCDF(d2(breakevenPrice)) * 100).toFixed(1));

      return {
        symbol: asset.symbol,
        companyName: asset.companyName ?? cotizacion.companyName ?? null,
        exchange: asset.exchange,
        sector: asset.sector,
        spotPrice: S,
        spotObservedAt: cotizacion.observedAt,
        spotSource: cotizacion.source,
        tradingViewSymbol: asset.tvSymbol,
        beta: asset.beta,
        dividendYield: asset.dividendYield,
        volatility: vol,
        isCustom: Boolean(asset.isCustom),
        optimalExpiration: targetExpiration,
        dteDays: validDte,
        pricing: {
          model: 'BLACK_SCHOLES',
          theoretical: true,
          volatility: vol,
          volatilitySource: asset.volatilitySource,
          riskFreeRate: r,
          note: 'Primas, métricas y probabilidades teóricas; no son cotizaciones de mercado ni precios de órdenes.',
        },
        putFloor: {
          strike: putStrike,
          theoreticalPremium: putTheoretical,
          delta: putBS.greeks.delta,
          moneyness: `${(((S - putStrike) / S) * 100).toFixed(1)}% OTM`,
          role: 'Póliza de Seguro Protector (Floor)',
        },
        callCeiling: {
          strike: callStrike,
          theoreticalPremium: callTheoretical,
          delta: callBS.greeks.delta,
          moneyness: `${(((callStrike - S) / S) * 100).toFixed(1)}% OTM`,
          role: 'Techo de Ganancia y Financiamiento (Ceiling)',
        },
        financialMetrics: {
          netDebitCredit,
          netCreditTotalUSD: netCreditUSD,
          cashFlowType: netDebitCredit >= 0 ? 'CRÉDITO NETO TEÓRICO' : 'DÉBITO NETO TEÓRICO',
          breakevenPrice,
          maxLossTotalUSD,
          maxProfitUSD,
          maxReturnPct,
        },
        probabilities: {
          floorProtectionPct,
          sweetSpotPct,
          assignmentRiskPct,
          winRatePct,
        },
      };
    });

    // 5. Ordenamiento según el criterio solicitado (cores ordena igual que probability; el panel aplica después los cores).
    if (sortBy === 'probability' || sortBy === 'cores') {
      evaluatedCandidates.sort((a, b) => b.probabilities.floorProtectionPct - a.probabilities.floorProtectionPct);
    } else if (sortBy === 'netCredit') {
      evaluatedCandidates.sort((a, b) => b.financialMetrics.netDebitCredit - a.financialMetrics.netDebitCredit);
    } else if (sortBy === 'maxReturn') {
      evaluatedCandidates.sort((a, b) => b.financialMetrics.maxReturnPct - a.financialMetrics.maxReturnPct);
    }

    const effectiveLimit = validLimits + newExtraSymbols.length;
    const rankedCandidates = evaluatedCandidates.slice(0, effectiveLimit).map((item, idx) => ({ rank: idx + 1, ...item }));

    return {
      timestamp: new Date().toISOString(),
      criteria: {
        limit: validLimits,
        sortBy,
        dteHorizon: validDte,
        targetExpiration,
        broker: corredor,
        totalScanned: fullBasket.length,
      },
      candidates: rankedCandidates,
      unavailable: unavailable.sort((a, b) => a.symbol.localeCompare(b.symbol)),
    };
  };
}

export const scanTopCollars = crearEscaner();

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
