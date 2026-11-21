import { available, partial, unavailable } from './observations.js';
import {
  alinear, clamp, claseAdx, escalasDeTendencia, fecha, mean, nivelesPuntuados, proyeccionDeEscala, round, smooth, zonaRsi,
} from './historialTecnico.js';

export { clamp, round };

const last = values => values.at(-1);

function momentum(closes) {
  const changes = closes.slice(1).map((value, index) => value - closes[index]);
  const gain = last(smooth(changes.map(value => Math.max(0, value)), 14, 1 / 14));
  const loss = last(smooth(changes.map(value => Math.max(0, -value)), 14, 1 / 14));
  const fast = smooth(closes, 12);
  const macd = smooth(closes, 26).map((value, index) => fast[index + 14] - value);
  const signal = smooth(macd, 9);
  const histogram = signal.map((value, index) => macd[index + 8] - value);
  let macdCross = null;
  for (let k = histogram.length - 1; k > 0; k--) {
    if (histogram[k] !== 0 && Math.sign(histogram[k]) !== Math.sign(histogram[k - 1])) {
      macdCross = { index: k + 33, type: histogram[k] > 0 ? 'BULLISH' : 'BEARISH' };
      break;
    }
  }
  return {
    rsi: loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss),
    histogram: last(macd) - last(signal),
    roc: (last(closes) / closes.at(-11) - 1) * 100,
    macdLine: last(macd), macdSignal: last(signal), macdCross,
  };
}

function strength(bars) {
  const moves = bars.slice(1).map((bar, index) => {
    const previous = bars[index];
    const up = bar.high - previous.high;
    const down = previous.low - bar.low;
    return {
      range: Math.max(bar.high - bar.low, Math.abs(bar.high - previous.close), Math.abs(bar.low - previous.close)),
      plus: up > down && up > 0 ? up : 0,
      minus: down > up && down > 0 ? down : 0,
    };
  });
  const average = key => smooth(moves.map(move => move[key]), 14, 1 / 14);
  const ranges = average('range');
  const plus = average('plus');
  const minus = average('minus');
  const dx = ranges.map((range, index) => range && plus[index] + minus[index]
    ? 100 * Math.abs(plus[index] - minus[index]) / (plus[index] + minus[index]) : 0);
  const adxSeries = smooth(dx, 14, 1 / 14);
  return {
    atr: last(ranges), adx: last(adxSeries), atrAverage: mean(ranges.slice(-20)),
    plusDI: last(ranges) ? 100 * last(plus) / last(ranges) : 0,
    minusDI: last(ranges) ? 100 * last(minus) / last(ranges) : 0,
    adxSeries: alinear(adxSeries, bars.length),
  };
}

function timeframe(bars) {
  const closes = bars.map(bar => bar.close);
  const close = last(closes);
  const ema20 = smooth(closes, 20);
  const ema50 = last(smooth(closes, 50));
  const { adx, atr, atrAverage } = strength(bars);
  const { rsi, histogram, roc } = momentum(closes);
  const center = mean(closes.slice(-20));
  const sigma = Math.sqrt(mean(closes.slice(-20).map(value => (value - center) ** 2)));
  const slope = last(ema20) - ema20.at(-4);
  const prior = bars.slice(-21, -11);
  const recent = bars.slice(-11, -1);
  const extrema = group => [Math.max(...group.map(bar => bar.high)), Math.min(...group.map(bar => bar.low))];
  const [priorHigh, priorLow] = extrema(prior);
  const [recentHigh, recentLow] = extrema(recent);
  const structure = recentHigh > priorHigh && recentLow > priorLow ? 1 : recentHigh < priorHigh && recentLow < priorLow ? -1 : 0;
  const emaDirection = Math.sign(last(ema20) - ema50);
  const direction = adx >= 20 && Math.sign(slope) === emaDirection && structure === emaDirection ? emaDirection : 0;
  const location = Math.sign(close - center);
  const condition = rsi >= 55 && rsi < 75 ? 1 : rsi <= 45 && rsi > 25 ? -1 : 0;
  const acceleration = Math.sign(histogram) === Math.sign(roc) ? Math.sign(histogram) : 0;
  const confluence = location !== 0 && location === condition && location === acceleration ? location : 0;
  const priorVolume = mean(bars.slice(-21, -1).map(bar => bar.volume));
  const relativeVolume = priorVolume > 0 ? last(bars).volume / priorVolume : 0;
  const breakout = relativeVolume > 1.2 ? (close > recentHigh ? 1 : close < recentLow ? -1 : 0) : 0;
  return { direction, confluence, location, condition, acceleration, breakout, adx: round(adx), atr: round(atr),
    ema20: round(last(ema20)), ema50: round(ema50), rsi: round(rsi), macdHistogram: round(histogram, 4), roc: round(roc),
    bollinger: { lower: round(center - 2 * sigma), middle: round(center), upper: round(center + 2 * sigma), width: round(4 * sigma / center * 100) },
    volatility: atr > atrAverage * 1.2 ? 'HIGH' : 'NORMAL', relativeVolume: round(relativeVolume) };
}

// Lectura de indicadores del marco diario con los parámetros de la guía (RSI 14, MACD 12/26/9, ADX 14, Bollinger 20/2).
function dailyIndicators(bars, daily, force) {
  const { macdLine, macdSignal, macdCross } = momentum(bars.map(bar => bar.close));
  return {
    rsi: { value: daily.rsi, zone: zonaRsi(daily.rsi) },
    macd: { line: round(macdLine, 4), signal: round(macdSignal, 4), histogram: daily.macdHistogram,
      lastCross: macdCross ? { type: macdCross.type, date: fecha(bars[macdCross.index].at) } : null },
    adx: { value: daily.adx, plusDI: round(force.plusDI), minusDI: round(force.minusDI), class: claseAdx(daily.adx) },
    bollinger: daily.bollinger,
  };
}

export function technicalCore(history) {
  const frames = ['1Day', '1Hour', '15Min'];
  if (!frames.every(frame => history?.series?.[frame]?.length >= 60)) return unavailable('Faltan velas cerradas para el análisis técnico.');
  const [daily, hourly, intraday] = frames.map(frame => timeframe(history.series[frame]));
  const conflicts = [hourly, intraday].filter(frame => daily.direction * frame.direction === -1).length;
  const bias = round(clamp((daily.direction * 45 + daily.confluence * 25 + hourly.confluence * 15 + intraday.breakout * 15)
    * (1 - conflicts * 0.25), -100, 100));
  const direction = Math.abs(bias) >= 25 ? Math.sign(bias) : 0;
  const dailyBars = history.series['1Day'];
  const force = strength(dailyBars);
  const trends = escalasDeTendencia(dailyBars, force.adxSeries);
  const result = { trend: daily.direction > 0 ? 'UP' : daily.direction < 0 ? 'DOWN' : 'SIDEWAYS',
    bias, direction, conflicts, timeframes: { daily, hourly, intraday }, ...nivelesPuntuados(dailyBars, daily.atr),
    scales: trends.scales, segments: trends.segments,
    projections: {
      intermediate: proyeccionDeEscala(trends.diferencias.intermediate, trends.disponibles.intermediate, history.calendar, 'la EMA50 y la SMA200'),
      short: proyeccionDeEscala(trends.diferencias.short, trends.disponibles.short, history.calendar, 'la EMA20 y la EMA50'),
    },
    indicators: dailyIndicators(dailyBars, daily, force),
    rule: 'Ruptura con cierre fuera del rango y volumen relativo > 1.2. El volumen por nivel es una aproximación por vela.',
    limitation: 'Los indicadores se calculan con velas pasadas y tienen rezago. El volumen de IEX es una fracción del consolidado y se usa como volumen relativo. La proyección es una extrapolación lineal informativa y no entra al puntaje.' };
  return available(result, history.evidence, { score: round(clamp(68 + 0.28 * bias)), direction, confidence: 0.82 - conflicts * 0.15 });
}

export function directSignalsCore(technical, events) {
  if (!technical?.result || !events?.result) return unavailable('La señal directa requiere observaciones técnicas y un calendario de eventos.');
  const { bias, direction, timeframes } = technical.result;
  const risk = events.result.risk;
  if (risk === 'UNVERIFIED') {
    // Sin fecha de resultados verificable no se puede descartar un evento cercano: se abstiene con el puntaje neutral.
    return partial({ signal: 'HOLD', strength: Math.abs(bias), rule: 'EVENT_UNVERIFIED', risk, reason: events.result.reason },
      `Earnings sin verificar: ${events.result.reason}`, technical.evidence, { score: 65, direction: 0, confidence: 0.5 });
  }
  const confirms = timeframes.daily.direction === direction && timeframes.hourly.direction === direction;
  const rule = risk === 'HIGH' ? 'EVENT_RISK' : confirms && Math.abs(bias) >= 45 ? 'DIRECTION_CONFIRMED' : 'INSUFFICIENT_CONFIRMATION';
  const side = rule === 'DIRECTION_CONFIRMED' ? direction : 0;
  const signal = side > 0 ? 'BUY' : side < 0 ? 'SELL' : 'HOLD';
  const score = round(clamp(65 + side * Math.abs(bias) * 0.3 - (risk === 'HIGH' ? 20 : 0)));
  return available({ signal, strength: Math.abs(bias), rule, risk }, [...technical.evidence, ...events.evidence],
    { score, direction: side, confidence: side === 0 ? 0.5 : 0.78 });
}
