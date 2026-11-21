// Datos de prueba con la forma del escáner y del Core 004; no son cotizaciones reales.
export const candidatoEscaner = {
  symbol: 'AAPL', spotPrice: 343.4,
  putFloor: { strike: 325, theoreticalPremium: 4.5 },
  callCeiling: { strike: 360, theoreticalPremium: 4.8 },
  financialMetrics: { netDebitCredit: 0.3, maxReturnPct: 4.92 },
  probabilities: { floorProtectionPct: 88.1 },
};
export const filaCores = {
  symbol: 'AAPL',
  cores: { '004': { status: 'AVAILABLE', result: {
    eligible: true, underlyingPrice: 343.4, shares: 100, expiration: '2026-12-31',
    put: { symbol: 'AAPL261231P00330000', strike: 330, expiration: '2026-12-31', bid: 6.95, ask: 9.2, at: Date.parse('2026-11-20T20:59:00Z') },
    call: { symbol: 'AAPL261231C00360000', strike: 360, expiration: '2026-12-31', bid: 5.2, ask: 6.75, at: Date.parse('2026-11-20T20:55:30Z') },
    netPremiumPerShare: 4, maxLoss: 1740, maxProfit: 1260, breakEven: 347.4,
  } } },
};
