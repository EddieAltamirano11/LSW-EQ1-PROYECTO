// Respuesta de prueba con la forma de GET /api/v2/strategy-screener/technical/:symbol.
// Es un dato de prueba para las funciones y componentes del cliente; no representa mercado real.
export const serieTecnica = {
  symbol: 'AAPL',
  asOf: '2026-11-21T01:52:00.000Z',
  cutoff: '2026-11-21T01:37:00.000Z',
  lastSession: '2026-11-20',
  source: 'Alpaca Market Data IEX',
  candles: [
    { time: '2026-11-18', open: 228, high: 231, low: 227, close: 230, volume: 1000 },
    { time: '2026-11-19', open: 230, high: 233, low: 229, close: 232, volume: 1200 },
    { time: '2026-11-20', open: 232, high: 234, low: 230, close: 231, volume: 900 },
  ],
  movingAverages: {
    sma200: [{ time: '2026-11-20', value: 210.5 }],
    ema50: [{ time: '2026-11-19', value: 224.1 }, { time: '2026-11-20', value: 224.4 }],
    ema20: [{ time: '2026-11-18', value: 228.2 }, { time: '2026-11-19', value: 228.6 }, { time: '2026-11-20', value: 228.9 }],
  },
  support: [
    { price: 220, lower: 219, upper: 221, touches: 4, score: 71.2, lastTouch: '2026-10-02', distancePct: -4.76 },
    { price: 215, lower: 214, upper: 216, touches: 2, score: 48.9, lastTouch: '2026-08-11', distancePct: -6.93 },
  ],
  resistance: [
    { price: 240, lower: 239, upper: 241, touches: 3, score: 64.5, lastTouch: '2026-09-15', distancePct: 3.9 },
  ],
  scales: {
    primary: { available: true, direction: 'UP', since: '2025-10-09', sessions: 281 },
    intermediate: { available: true, direction: 'UP', since: '2025-09-11', sessions: 300 },
    short: { available: true, direction: 'SIDEWAYS', since: '2026-11-02', sessions: 15 },
  },
  segments: {
    primary: [{ direction: 'UP', start: '2026-11-18', end: '2026-11-20', sessions: 3, changePct: 0.43 }],
    intermediate: [{ direction: 'UP', start: '2026-11-18', end: '2026-11-20', sessions: 3, changePct: 0.43 }],
    short: [
      { direction: 'UP', start: '2026-11-18', end: '2026-11-19', sessions: 2, changePct: 0.87 },
      { direction: 'SIDEWAYS', start: '2026-11-20', end: '2026-11-20', sessions: 1, changePct: 0 },
    ],
  },
  projections: {
    intermediate: {
      available: true, projected: false, reason: 'Las medias se separan; no hay cambio proyectado.',
      accuracy: { cases: 2, hitRate: 0.5, meanErrorSessions: 12, insufficientSample: true },
    },
    short: {
      available: true, projected: true, direction: 'DOWN', sessions: { from: 5, to: 8 }, openEnded: false,
      window: { from: '2026-11-30', to: '2026-12-03' },
      assumption: 'Supone que se mantiene la pendiente de los últimos 20 días de la diferencia entre la EMA20 y la EMA50.',
      accuracy: { cases: 4, hitRate: 0.25, meanErrorSessions: 28.4, insufficientSample: false },
    },
  },
  upcoming: ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03'],
  limitation: 'La proyección es una extrapolación lineal informativa y no entra al puntaje.',
  evidence: [],
};
