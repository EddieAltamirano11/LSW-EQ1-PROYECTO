import { DAY, available, partial, time, unavailable } from './observations.js';
import { clamp, round } from './technicalCore.js';

const canDivide = (numerator, denominator) => Number.isFinite(numerator) && denominator > 0;
const ratio = (numerator, denominator) => canDivide(numerator, denominator) ? numerator / denominator : null;
const addDebt = year => [year.shortDebt, year.currentDebt, year.longDebt].some(Number.isFinite)
  ? [year.shortDebt, year.currentDebt, year.longDebt].reduce((sum, value) => sum + (value ?? 0), 0) : null;
const diff = (a, b) => Number.isFinite(a) && Number.isFinite(b) ? a - b : null;

// Sin fecha de resultados el riesgo queda UNVERIFIED, con la causa y la fuente consultada, y sin evidencia del calendario.
export function riesgoSinVerificar(causa, fuente) {
  return partial({ risk: 'UNVERIFIED', reason: causa, source: fuente ?? null, days: null, start: null, end: null, estimated: null },
    `Earnings sin verificar: ${causa}`, []);
}

export function eventRisk(event, asOf) {
  if (!event) return riesgoSinVerificar('No hay una fecha de resultados verificable.');
  const days = Math.ceil((time(event.start) - asOf) / DAY);
  const risk = days <= 7 ? 'HIGH' : days <= 30 ? 'MEDIUM' : 'LOW';
  return available({ risk, days, start: event.start, end: event.end, estimated: event.estimated }, [event.evidence]);
}

function fScore(current, prior) {
  const assetsPrior = prior.assets;
  const roa = ratio(current.net, assetsPrior);
  const priorRoa = ratio(prior.net, assetsPrior);
  const cashReturn = ratio(current.cashFlow, assetsPrior);
  const evidence = {
    positiveRoa: roa === null ? null : roa > 0,
    positiveCashFlow: current.cashFlow === null ? null : current.cashFlow > 0,
    improvedRoa: diff(roa, priorRoa),
    operatingCashAboveIncome: diff(cashReturn, roa),
    reducedLongDebt: diff(ratio(prior.longDebt, prior.assets), ratio(current.longDebt, current.assets)),
    improvedCurrentRatio: diff(ratio(current.currentAssets, current.currentLiabilities), ratio(prior.currentAssets, prior.currentLiabilities)),
    nonDilutionProxy: diff(prior.shares, current.shares),
    improvedGrossMargin: diff(ratio(current.gross, current.revenue), ratio(prior.gross, prior.revenue)),
    improvedTurnover: diff(ratio(current.revenue, current.assets), ratio(prior.revenue, prior.assets)),
  };
  const tests = Object.fromEntries(Object.entries(evidence).map(([key, value]) => [key,
    typeof value === 'number' ? (key === 'nonDilutionProxy' ? value >= 0 : value > 0) : value]));
  return { passed: Object.values(tests).filter(value => value === true).length,
    evaluated: Object.values(tests).filter(value => value !== null).length, tests,
    limitation: 'Aproximación con dos ejercicios. Las acciones medias aproximan la dilución y los activos de cierre aproximan los activos medios.' };
}

function altman(year, marketValue, sic) {
  if (!Number.isInteger(sic) || sic <= 0 || (sic >= 6000 && sic < 7000)) return null;
  const working = ratio(diff(year.currentAssets, year.currentLiabilities), year.assets);
  const retained = ratio(year.retained, year.assets);
  const operating = ratio(year.operating, year.assets);
  if ([working, retained, operating].includes(null)) return null;
  if (sic >= 2000 && sic < 4000) {
    const capital = ratio(marketValue, year.liabilities);
    const turnover = ratio(year.revenue, year.assets);
    if (capital === null || turnover === null) return null;
    return { value: 1.2 * working + 1.4 * retained + 3.3 * operating + 0.6 * capital + turnover,
      lower: 1.81, upper: 2.99, variant: 'Z · manufactura pública' };
  }
  const capital = ratio(year.equity, year.liabilities);
  if (capital === null) return null;
  return { value: 6.56 * working + 3.26 * retained + 6.72 * operating + 1.05 * capital,
    lower: 1.1, upper: 2.6, variant: 'Z doble prima · no manufactura' };
}

export function fundamentalCore(statements, spot, events) {
  if (!statements || !(spot?.price > 0)) return unavailable('Faltan estados financieros publicados o precio observado.');
  const [year, prior] = statements.years;
  const evidence = [...statements.evidence, spot.evidence, ...(events?.evidence ?? [])];
  const marketValue = year.shares > 0 ? year.shares * spot.price : null;
  const z = altman(year, marketValue, statements.sic);
  const pe = ratio(spot.price, year.eps);
  const ps = ratio(marketValue, year.revenue);
  const operatingMargin = ratio(year.operating, year.revenue);
  const growth = ratio(diff(year.revenue, prior.revenue), prior.revenue);
  const debt = addDebt(year);
  const netDebtToOperating = ratio(diff(debt, year.cash), year.operating);
  const health = fScore(year, prior);
  const indicators = { pe, ps, operatingMargin, revenueGrowth: growth, netDebtToOperating,
    interestCoverage: ratio(year.operating, year.interest), operatingCashFlow: year.cashFlow };
  const classification = !z || year.cashFlow === null || year.operating === null ? 'UNKNOWN'
    : z.value < z.lower ? 'NO_VIABLE' : z.value <= z.upper || year.cashFlow <= 0 || year.operating <= 0 ? 'MARGINAL' : 'VIABLE';
  const result = { classification, cik: statements.cik, fiscalYears: statements.years.map(value => value.end),
    risk: events?.result?.risk ?? 'UNKNOWN', event: events?.result ?? null, indicators, piotroski: health,
    altman: z ? { ...z, value: round(z.value) } : null, valuationMethod: 'Múltiplos observados con rangos de referencia de la política v1.',
    limitations: ['Indicadores contables históricos. El valor de mercado se estima con el precio observado y las acciones medias publicadas.'],
    references: statements.references };
  if (!z || year.cashFlow === null || operatingMargin === null || growth === null || health.evaluated < 6) {
    return partial(result, 'Cobertura contable insuficiente para un puntaje comparable.', evidence);
  }
  const quality = clamp(50 + operatingMargin * 100);
  const solvency = clamp(45 + (z.value - z.lower) * 18);
  const growthScore = clamp(50 + growth * 140);
  const valuation = pe === null ? 20 : clamp(100 - pe * 1.6 - (ps ?? 0) * 2);
  const score = round(quality * 0.25 + solvency * 0.25 + growthScore * 0.15 + valuation * 0.15
    + 20 * health.passed / health.evaluated);
  result.valuation = pe === null ? 'NO_POSITIVE_EARNINGS' : valuation >= 70 ? 'UNDERVALUED' : valuation >= 40 ? 'FAIR' : 'OVERVALUED';
  result.qualityFlags = [classification !== 'VIABLE' ? classification : null, year.interest === null ? 'INTEREST_COVERAGE_UNAVAILABLE' : null,
    netDebtToOperating !== null && netDebtToOperating > 3 ? 'HIGH_LEVERAGE' : null].filter(Boolean);
  const signals = { score, direction: 0, confidence: round(0.7 + health.evaluated * 0.018) };
  // El puntaje no depende de los eventos: con el riesgo sin verificar se conserva y el core queda parcial.
  if (!events?.result || events.result.risk === 'UNVERIFIED') {
    return partial(result, `Earnings sin verificar: ${events?.result?.reason ?? 'sin fecha de resultados'}`, evidence, signals);
  }
  return available(result, evidence, signals);
}
