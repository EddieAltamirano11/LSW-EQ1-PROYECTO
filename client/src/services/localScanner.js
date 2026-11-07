/**
 * Motor Cuantitativo Local (Fallback Autónomo y Offline)
 * Permite ejecutar el Scanner de Top 5 / Top 10 con la canasta institucional
 * de Wall Street, cálculo Black-Scholes d2, griegas y optimización de Collar Spread
 * incluso si el backend en la nube está en arranque o solo dispone de v1.
 */

export const BASKET = [
  {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    exchange: 'NASDAQ',
    tvSymbol: 'NASDAQ:AAPL',
    sector: 'Tecnología de Consumo',
    beta: 1.05,
    referenceSpot: 227.50,
    baseVolatility: 0.22,
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
    referenceSpot: 420.25,
    baseVolatility: 0.24,
    rsi14: 61.2,
    aboveSma200: true,
  },
  {
    symbol: 'NVDA',
    companyName: 'NVIDIA Corporation',
    exchange: 'NASDAQ',
    tvSymbol: 'NASDAQ:NVDA',
    sector: 'Semiconductores & IA',
    beta: 1.68,
    referenceSpot: 141.80,
    baseVolatility: 0.46,
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
    referenceSpot: 178.60,
    baseVolatility: 0.26,
    rsi14: 53.1,
    aboveSma200: true,
  },
  {
    symbol: 'AMZN',
    companyName: 'Amazon.com Inc.',
    exchange: 'NASDAQ',
    tvSymbol: 'NASDAQ:AMZN',
    sector: 'E-Commerce & Cloud Computing',
    beta: 1.24,
    referenceSpot: 195.40,
    baseVolatility: 0.28,
    rsi14: 57.6,
    aboveSma200: true,
  },
  {
    symbol: 'META',
    companyName: 'Meta Platforms Inc.',
    exchange: 'NASDAQ',
    tvSymbol: 'NASDAQ:META',
    sector: 'Medios Interactivos & Redes',
    beta: 1.29,
    referenceSpot: 582.00,
    baseVolatility: 0.32,
    rsi14: 60.5,
    aboveSma200: true,
  },
  {
    symbol: 'TSLA',
    companyName: 'Tesla Inc.',
    exchange: 'NASDAQ',
    tvSymbol: 'NASDAQ:TSLA',
    sector: 'Automotriz & Energía Limpia',
    beta: 2.12,
    referenceSpot: 250.20,
    baseVolatility: 0.52,
    rsi14: 52.8,
    aboveSma200: true,
  },
  {
    symbol: 'AMD',
    companyName: 'Advanced Micro Devices',
    exchange: 'NASDAQ',
    tvSymbol: 'NASDAQ:AMD',
    sector: 'Semiconductores',
    beta: 1.65,
    referenceSpot: 154.30,
    baseVolatility: 0.44,
    rsi14: 51.4,
    aboveSma200: true,
  },
  {
    symbol: 'SPY',
    companyName: 'SPDR S&P 500 ETF Trust',
    exchange: 'AMEX',
    tvSymbol: 'AMEX:SPY',
    sector: 'Índice General S&P 500 (ETF)',
    beta: 1.00,
    referenceSpot: 585.10,
    baseVolatility: 0.14,
    rsi14: 59.2,
    aboveSma200: true,
  },
  {
    symbol: 'QQQ',
    companyName: 'Invesco QQQ Trust (Nasdaq 100)',
    exchange: 'NASDAQ',
    tvSymbol: 'NASDAQ:QQQ',
    sector: 'Índice Tecnológico Top 100 (ETF)',
    beta: 1.18,
    referenceSpot: 498.40,
    baseVolatility: 0.18,
    rsi14: 60.1,
    aboveSma200: true,
  },
];

export const normalCDF = (x) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const prob =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - prob : prob;
};

export const computeLocalCandidates = (limit = 5, sortBy = 'probability', dteHorizon = 45) => {
  const T = dteHorizon / 365;
  const r = 0.045; // 4.5% tasa libre de riesgo Fed

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dteHorizon);
  const expirationStr = targetDate.toISOString().split('T')[0];

  const evaluated = BASKET.map((asset) => {
    const spot = asset.referenceSpot;
    const vol = asset.baseVolatility;

    // Put OTM defensivo (-5%) y Call OTM financiado (+7%)
    const putStrike = Math.round((spot * 0.95) / 2.5) * 2.5;
    const callStrike = Math.round((spot * 1.07) / 2.5) * 2.5;

    // Black-Scholes para Put
    const d1Put = (Math.log(spot / putStrike) + (r + 0.5 * vol * vol) * T) / (vol * Math.sqrt(T));
    const d2Put = d1Put - vol * Math.sqrt(T);
    const putFloorProb = normalCDF(d2Put);

    // Black-Scholes para Call
    const d1Call = (Math.log(spot / callStrike) + (r + 0.5 * vol * vol) * T) / (vol * Math.sqrt(T));
    const d2Call = d1Call - vol * Math.sqrt(T);
    const callProb = normalCDF(d2Call);

    // Precios teóricos de primas
    const disc = Math.exp(-r * T);
    const callPremium = Number((spot * normalCDF(d1Call) - callStrike * disc * normalCDF(d2Call)).toFixed(2));
    const putPremium = Number((putStrike * disc * normalCDF(-d2Put) - spot * normalCDF(-d1Put)).toFixed(2));

    const netCreditPerShare = Number((callPremium - putPremium).toFixed(2));
    const netCreditTotal = Math.round(netCreditPerShare * 100);

    const maxProfitPerShare = Number((callStrike - spot + netCreditPerShare).toFixed(2));
    const maxReturnPct = Number(((maxProfitPerShare / spot) * 100).toFixed(2));
    const sweetSpotPct = Number((Math.max(0.05, putFloorProb - callProb) * 100).toFixed(1));

    return {
      symbol: asset.symbol,
      companyName: asset.companyName,
      exchange: asset.exchange,
      tradingViewSymbol: asset.tvSymbol,
      sector: asset.sector,
      spotPrice: spot,
      impliedVolatility: vol,
      optimalExpiration: expirationStr,
      daysToExpiration: dteHorizon,
      technicalOutlook: asset.rsi14 > 60 ? 'BULLISH' : 'NEUTRAL_BULLISH',
      putFloor: {
        strike: putStrike,
        moneyness: 'OTM (-5.0%)',
        marketPremium: putPremium,
        delta: Number((-normalCDF(-d1Put)).toFixed(3)),
      },
      callCeiling: {
        strike: callStrike,
        moneyness: 'OTM (+7.0%)',
        marketPremium: callPremium,
        delta: Number(normalCDF(d1Call).toFixed(3)),
      },
      probabilities: {
        floorProtectionPct: Number((putFloorProb * 100).toFixed(1)),
        sweetSpotPct: Number(sweetSpotPct),
        callCapExercisePct: Number((callProb * 100).toFixed(1)),
      },
      financialMetrics: {
        netDebitCredit: netCreditPerShare,
        netCreditTotalUSD: netCreditTotal,
        maxProfitUSD: Math.round(maxProfitPerShare * 100),
        maxReturnPct,
      },
    };
  });

  // Ordenamiento solicitado
  if (sortBy === 'netCredit') {
    evaluated.sort((a, b) => b.financialMetrics.netDebitCredit - a.financialMetrics.netDebitCredit);
  } else if (sortBy === 'maxReturn') {
    evaluated.sort((a, b) => b.financialMetrics.maxReturnPct - a.financialMetrics.maxReturnPct);
  } else {
    evaluated.sort((a, b) => b.probabilities.floorProtectionPct - a.probabilities.floorProtectionPct);
  }

  const topCandidates = evaluated.slice(0, limit).map((item, index) => ({
    rank: index + 1,
    ...item,
  }));

  return {
    success: true,
    engine: 'Black-Scholes (F0) & Stochastic d2 Engine (Modo Cuantitativo Local)',
    totalScanned: BASKET.length,
    returnedCandidates: topCandidates.length,
    criteria: {
      targetExpiration: expirationStr,
      dteHorizon,
      sortBy,
      limit,
    },
    candidates: topCandidates,
  };
};
