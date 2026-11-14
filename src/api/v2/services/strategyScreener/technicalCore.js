import { available, unavailable } from './observations.js';

export const clamp = (value, lower = 0, upper = 100) => Math.max(lower, Math.min(upper, value));
export const round = (value, decimals = 2) => Number(value.toFixed(decimals));
const mean = values => values.reduce((sum, item) => sum + item, 0) / values.length;
const last = values => values.at(-1);

function smooth(values, period, factor = 2 / (period + 1)) {
  if (values.length < period) return [];
  const averages = [mean(values.slice(0, period))];
  for (const value of values.slice(period)) averages.push(last(averages) + factor * (value - last(averages)));
  return averages;
}

function momentum(closes) {
  const changes = closes.slice(1).map((value, index) => value - closes[index]);
  const gain = last(smooth(changes.map(value => Math.max(0, value)), 14, 1 / 14));
  const loss = last(smooth(changes.map(value => Math.max(0, -value)), 14, 1 / 14));
  const fast = smooth(closes, 12);
  const macd = smooth(closes, 26).map((value, index) => fast[index + 14] - value);
  return {
    rsi: loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss),
    histogram: last(macd) - last(smooth(macd, 9)),
    roc: (last(closes) / closes.at(-11) - 1) * 100,
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
  return { atr: last(ranges), adx: last(smooth(dx, 14, 1 / 14)), atrAverage: mean(ranges.slice(-20)) };
}

function zones(bars, atr) {
  const close = last(bars).close;
  const pivots = [];
  const recent = bars.slice(-61, -1);
  for (let i = 2; i < recent.length - 2; i++) {
    const bar = recent[i];
    const neighbors = recent.slice(i - 2, i + 3).filter(row => row !== bar);
    if (neighbors.every(row => row.low > bar.low)) pivots.push({ price: bar.low, volume: bar.volume });
    if (neighbors.every(row => row.high < bar.high)) pivots.push({ price: bar.high, volume: bar.volume });
  }
  const tolerance = Math.max(atr * 0.35, close * 0.002);
  const step = close >= 100 ? 5 : close >= 20 ? 1 : 0.5;
  const levels = [...new Set(pivots.map(point => round(point.price)).concat([Math.floor(close / step) * step, Math.ceil(close / step) * step]))]
    .map(price => {
      const touches = pivots.filter(pivot => Math.abs(pivot.price - price) <= tolerance).length;
      const volumeNear = recent.filter(bar => Math.abs((bar.high + bar.low + bar.close) / 3 - price) <= tolerance)
        .reduce((sum, bar) => sum + bar.volume, 0);
      return { price, touches, volumeNear };
    });
  const support = levels.filter(level => level.price < close).sort((a, b) => b.price - a.price).slice(0, 3);
  const resistance = levels.filter(level => level.price > close).sort((a, b) => a.price - b.price).slice(0, 3);
  return { support, resistance };
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

export function technicalCore(history) {
  const frames = ['1Day', '1Hour', '15Min'];
  if (!frames.every(frame => history?.series?.[frame]?.length >= 60)) return unavailable('Faltan velas cerradas para el análisis técnico.');
  const [daily, hourly, intraday] = frames.map(frame => timeframe(history.series[frame]));
  const conflicts = [hourly, intraday].filter(frame => daily.direction * frame.direction === -1).length;
  const bias = round(clamp((daily.direction * 45 + daily.confluence * 25 + hourly.confluence * 15 + intraday.breakout * 15)
    * (1 - conflicts * 0.25), -100, 100));
  const direction = Math.abs(bias) >= 25 ? Math.sign(bias) : 0;
  const result = { trend: daily.direction > 0 ? 'UP' : daily.direction < 0 ? 'DOWN' : 'SIDEWAYS',
    bias, direction, conflicts, timeframes: { daily, hourly, intraday }, ...zones(history.series['1Day'], daily.atr),
    rule: 'Ruptura con cierre fuera del rango y volumen relativo > 1.2. El volumen por nivel es una aproximación por vela.',
    limitation: 'Los indicadores se calculan con velas pasadas y tienen rezago.' };
  return available(result, history.evidence, { score: round(clamp(68 + 0.28 * bias)), direction, confidence: 0.82 - conflicts * 0.15 });
}

export function directSignalsCore(technical, events) {
  if (!technical?.result || !events?.result) return unavailable('La señal directa requiere observaciones técnicas y un calendario de eventos.');
  const { bias, direction, timeframes } = technical.result;
  const risk = events.result.risk;
  const confirms = timeframes.daily.direction === direction && timeframes.hourly.direction === direction;
  const rule = risk === 'HIGH' ? 'EVENT_RISK' : confirms && Math.abs(bias) >= 45 ? 'DIRECTION_CONFIRMED' : 'INSUFFICIENT_CONFIRMATION';
  const side = rule === 'DIRECTION_CONFIRMED' ? direction : 0;
  const signal = side > 0 ? 'BUY' : side < 0 ? 'SELL' : 'HOLD';
  const score = round(clamp(65 + side * Math.abs(bias) * 0.3 - (risk === 'HIGH' ? 20 : 0)));
  return available({ signal, strength: Math.abs(bias), rule, risk }, [...technical.evidence, ...events.evidence],
    { score, direction: side, confidence: side === 0 ? 0.5 : 0.78 });
}
