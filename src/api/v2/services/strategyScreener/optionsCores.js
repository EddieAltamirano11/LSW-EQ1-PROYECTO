import { available, iso, observation, partial, time, unavailable } from './observations.js';
import { clamp, round } from './technicalCore.js';

const spread = option => 2 * (option.ask - option.bid) / (option.ask + option.bid);

function liquid(option) {
  return option.standard && option.multiplier === 100 && option.bid > 0 && option.ask >= option.bid
    && spread(option) <= 0.35 && option.interest >= 10 && option.volume >= 1;
}

function contractEvidence(option) {
  return observation('Webull OpenAPI · Option Snapshot', iso(option.at), option.symbol, option.delay);
}

export function strategyCore(spot, chain) {
  if (!chain || !(spot?.price > 0)) return unavailable('Faltan precio del subyacente o cadena con cotizaciones verificables.');
  const quotes = chain.contracts.filter(liquid);
  const pairs = quotes.filter(option => option.type === 'put' && option.strike < spot.price).flatMap(put => quotes
    .filter(call => call.type === 'call' && call.expiration === put.expiration && call.strike > spot.price
      && call.multiplier === put.multiplier && call.underlying === put.underlying)
    .map(call => ({ put, call, distance: Math.abs(put.strike / spot.price - 0.95) + Math.abs(call.strike / spot.price - 1.05) })));
  pairs.sort((a, b) => Math.abs(time(a.put.expiration) - chain.target) - Math.abs(time(b.put.expiration) - chain.target)
    || a.distance - b.distance || spread(a.put) + spread(a.call) - spread(b.put) - spread(b.call)
    || a.put.symbol.localeCompare(b.put.symbol) || a.call.symbol.localeCompare(b.call.symbol));
  const baseEvidence = [spot.evidence, ...chain.evidence];
  const pair = pairs.find(({ put, call }) => {
    const basis = spot.price + put.ask - call.bid;
    return basis >= put.strike && basis <= call.strike;
  });
  if (!pair) return available({ eligible: false, reason: 'No hay un put y un call compatibles con liquidez y costo verificables.' }, baseEvidence);
  const { put, call } = pair;
  const cost = put.ask - call.bid;
  const basis = spot.price + cost;
  return available({ eligible: true, underlyingPrice: spot.price, expiration: put.expiration, shares: put.multiplier,
    put: { ...put, spreadPct: round(spread(put) * 100) }, call: { ...call, spreadPct: round(spread(call) * 100) },
    netPremiumPerShare: round(cost), maxLoss: round((basis - put.strike) * put.multiplier),
    maxProfit: round((call.strike - basis) * call.multiplier), breakEven: round(basis), currency: 'USD',
    scenario: 'Acciones largas al precio de referencia, put al ask y call al bid. Métricas al vencimiento antes de comisiones.' },
  [...baseEvidence, contractEvidence(put), contractEvidence(call)]);
}

export function institutionalCore(flow, holdings, reportEvidence) {
  if (!flow?.length) return unavailable('No hay contratos con actividad verificable para el análisis institucional.');
  const evidence = flow.flatMap(item => [item.evidence, contractEvidence(item.contract)]);
  if (reportEvidence) evidence.push(reportEvidence);
  const zones = flow.map(({ contract, trades }) => {
    const ratio = contract.interest > 0 ? contract.volume / contract.interest : null;
    const known = trades.filter(trade => trade.side);
    const total = trades.reduce((sum, trade) => sum + trade.size * trade.price * contract.multiplier, 0);
    const signed = known.reduce((sum, trade) => sum + trade.size * trade.price * contract.multiplier
      * (trade.side === 'B' ? 1 : -1) * (contract.type === 'call' ? 1 : -1), 0);
    return { symbol: contract.symbol, expiration: contract.expiration, strike: contract.strike,
      type: contract.type, volume: contract.volume, openInterest: contract.interest, volumeToInterest: ratio === null ? null : round(ratio),
      sampledTrades: trades.length, totalSamplePremium: round(total), signedSamplePremium: signed,
      unusual: ratio !== null && ratio > 1, largeFlow: ratio !== null && ratio >= 5 && total >= 500_000,
      gammaOpenInterest: contract.gamma === null ? null : round(contract.gamma * contract.interest * contract.multiplier, 4),
      directionalTrades: known.length };
  });
  const total = zones.reduce((sum, row) => sum + row.totalSamplePremium, 0);
  const signed = zones.reduce((sum, row) => sum + row.signedSamplePremium, 0);
  const known = zones.reduce((sum, row) => sum + row.directionalTrades, 0);
  const tilt = total > 0 ? signed / total : 0;
  const direction = known >= 3 && Math.abs(tilt) >= 0.2 ? Math.sign(tilt) : 0;
  const intensity = round(clamp(Math.max(...zones.map(row => (row.volumeToInterest ?? 0) * 25)) + Math.log10(1 + total) * 7));
  const result = { direction: known < 3 ? 'UNDETERMINED' : direction > 0 ? 'BULLISH' : direction < 0 ? 'BEARISH' : 'NEUTRAL',
    strength: intensity, zones, holdings, inference: 'El lado informado aproxima presión en la muestra. La identidad y apertura o cierre de las posiciones son desconocidos. Gamma por interés abierto es exposición bruta sin signo de dealer.' };
  if (zones.every(zone => zone.sampledTrades === 0)) return partial(result, 'La consulta no devolvió operaciones de la sesión analizada.', evidence);
  const scores = { score: round(clamp(66 + 0.20 * direction * intensity)), direction, confidence: known < 3 ? 0.45 : 0.72 };
  return reportEvidence ? available(result, evidence, scores) : partial(result, 'El contexto 13F está temporalmente indisponible.', evidence, scores);
}
