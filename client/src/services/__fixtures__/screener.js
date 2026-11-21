// Respuesta de prueba con la forma de POST /api/v2/strategy-screener/run.
// Es un dato de prueba para los componentes del cliente; no representa mercado real.
const evidencia = [{ source: 'Fuente de prueba', observedAt: '2026-11-20T21:00:00Z', reference: 'referencia', delayMinutes: 0 }];

const tecnico = (trend, rsi) => ({
  status: 'AVAILABLE', active: true, role: 'CONFLUENCE', effectiveWeight: 0.225, score: 75, evidence: evidencia,
  result: {
    trend, timeframes: { daily: { adx: 27.4, rsi, macdHistogram: 0.12, atr: 3.1, relativeVolume: 1.1 } },
    support: [{ price: 220 }], resistance: [{ price: 240 }],
  },
});

const fundamental = classification => ({
  status: 'AVAILABLE', active: false, role: 'GATE', score: 70, evidence: evidencia,
  result: {
    classification, valuation: 'FAIR', risk: 'LOW', event: { start: '2027-01-28', estimated: false },
    altman: { value: 4.2 }, piotroski: { passed: 7, evaluated: 9 }, indicators: { pe: 28.1 }, fiscalYears: [2026, 2025],
  },
});

const estrategia = {
  status: 'AVAILABLE', role: 'GATE', score: 80, evidence: evidencia,
  result: {
    eligible: true, underlyingPrice: 231, expiration: '2027-01-15', shares: 100, netPremiumPerShare: 0.2,
    maxLoss: 1120, maxProfit: 880, breakEven: 231.2,
    put: { symbol: 'AAPL270115P00220000', strike: 220, ask: 4.1 }, call: { symbol: 'AAPL270115C00240000', strike: 240, bid: 3.9 },
  },
};

const confluencia = {
  status: 'AVAILABLE', role: 'SYNTHESIS', score: 75, evidence: evidencia,
  result: { score: 75, confidence: 0.8, signal: null, conflicts: [], drivers: [{ id: '001', weight: 1, score: 75 }], dependency: null },
};

const noCalculado = { status: 'NOT_SELECTED', active: false, role: 'NOT_COMPUTED', result: null, evidence: [] };

export const screener = {
  asOf: '2026-11-20T21:00:00.000Z',
  criteria: { mode: 'BY_STRATEGY', strategy: 'COLLAR_SPREAD', activeCores: ['001'] },
  status: 'COMPLETE',
  candidates: [
    {
      rank: 1, symbol: 'AAPL', companyName: 'Apple Inc.', eligibility: 'VIABLE', score: 75,
      cores: { '001': tecnico('UP', 58.2), '002': fundamental('VIABLE'), '003': noCalculado, '004': estrategia,
        '005': noCalculado, '006': noCalculado, '007': confluencia },
    },
  ],
  excluded: [
    {
      symbol: 'XYZ', companyName: 'XYZ Corp.', eligibility: 'MARGINAL', reason: 'Veto de viabilidad MARGINAL.',
      cores: { '001': tecnico('DOWN', 38.5), '002': fundamental('MARGINAL'), '003': noCalculado,
        '004': { status: 'UNAVAILABLE', role: 'NOT_COMPUTED', reason: 'Veto de viabilidad MARGINAL.', result: null, evidence: [] },
        '005': noCalculado, '006': noCalculado,
        '007': { ...confluencia } },
    },
  ],
};
