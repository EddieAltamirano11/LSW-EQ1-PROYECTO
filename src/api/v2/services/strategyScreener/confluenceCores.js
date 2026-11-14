import { DAY, available, iso, observation, time, unavailable, uniqueBy } from './observations.js';
import { clamp, round } from './technicalCore.js';

export const SOURCE_CORES = ['001', '002', '003', '005', '006'];
const WEIGHTS = { '001': 30, '002': 20, '003': 20, '005': 15, '006': 15 };
const POSITIVE = /(?:\b(?:beats? (?:earnings |revenue )?(?:estimates|expectations)|raises? (?:its )?(?:guidance|outlook)|upgrades? (?:to|from)|record (?:revenue|profit)|wins? (?:an? )?(?:contract|approval)|strong (?:earnings|growth))\b)/gi;
const NEGATIVE = /(?:\b(?:miss(?:es|ed)? (?:earnings |revenue )?(?:estimates|expectations)|cuts? (?:its )?(?:guidance|outlook)|downgrades? (?:to|from)|profit warning|files? for bankruptcy|antitrust (?:probe|lawsuit)|regulatory (?:probe|fine)|recalls? (?:its|the))\b)/gi;
const EVENTS = [
  ['EARNINGS', /\b(?:earnings|quarterly results|guidance)\b/i],
  ['M&A', /\b(?:acqui(?:res|sition)|merger|takeover)\b/i],
  ['REGULATORY', /\b(?:sec probe|lawsuit|regulatory|antitrust|recall)\b/i],
  ['MACRO', /\b(?:federal reserve|interest rate|inflation|tariffs?)\b/i],
];

function headlineKey(headline) {
  return headline.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

export function newsCore(news, asOf) {
  if (!news) return unavailable('No se pudo verificar la ventana de noticias.');
  const sorted = news.articles.slice().sort((a, b) => time(b.created_at) - time(a.created_at) || String(a.id).localeCompare(String(b.id)));
  const ids = new Set();
  const urls = new Set();
  const headlines = new Set();
  const items = [];
  for (const item of sorted) {
    const headline = headlineKey(item.headline);
    const id = item.id == null ? null : `${item.source}:${item.id}`;
    const url = item.url?.split('?')[0];
    if (!headline || (id && ids.has(id)) || (url && urls.has(url)) || headlines.has(headline)) continue;
    if (id) ids.add(id);
    if (url) urls.add(url);
    headlines.add(headline);
    const content = `${item.headline} ${item.summary ?? ''}`;
    const type = EVENTS.find(([, pattern]) => pattern.test(content))?.[0] ?? 'OTHER';
    const sentiment = clamp((item.headline.match(POSITIVE)?.length ?? 0) - (item.headline.match(NEGATIVE)?.length ?? 0)
      + 0.5 * ((String(item.summary ?? '').match(POSITIVE)?.length ?? 0) - (String(item.summary ?? '').match(NEGATIVE)?.length ?? 0)), -1, 1);
    const relevance = 1 / Math.sqrt(Math.max(1, item.symbols.length));
    const freshness = Math.exp(-Math.max(0, asOf - time(item.created_at)) / (3 * DAY));
    const impact = sentiment * relevance * freshness * (type === 'OTHER' ? 0.6 : 1);
    const publicUrl = typeof item.url === 'string' && /^https:\/\//i.test(item.url) ? item.url : null;
    items.push({ headline: item.headline, id: item.id, source: item.source, publishedAt: item.created_at, url: publicUrl, type, relevance: round(relevance), impact: round(impact, 4) });
  }
  const used = items.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact) || time(b.publishedAt) - time(a.publishedAt)).slice(0, 8);
  const impact = round(clamp(45 * used.reduce((sum, item) => sum + item.impact, 0), -100, 100));
  const direction = Math.abs(impact) >= 15 ? Math.sign(impact) : 0;
  const result = { impact, sentiment: direction > 0 ? 'POSITIVE' : direction < 0 ? 'NEGATIVE' : 'NEUTRAL',
    headlines: used, observed: items.length, classifier: 'Reglas de lenguaje financiero EN v1',
    limitation: 'El impacto es una estimación por frases, relevancia y antigüedad. Los titulares ambiguos conservan un sesgo neutral.' };
  return available(result, [news.evidence, ...used.map(item => observation(item.source || 'Alpaca News', item.publishedAt, String(item.id ?? item.headline)))],
    { score: round(clamp(66 + impact * 0.28)), direction, confidence: direction ? 0.68 : 0.5 });
}

export function confluenceCore(active, cores, asOf) {
  const sources = active.map(id => ({ id, ...cores[id], weight: WEIGHTS[id] }));
  if (sources.some(source => !Number.isFinite(source.score))) return unavailable('Faltan puntajes comparables de uno o más cores activos.');
  const hasTechnicalGroup = active.includes('001') && active.includes('003');
  const group = id => id === '003' ? '001' : id;
  if (hasTechnicalGroup) {
    const sum = WEIGHTS['001'] + WEIGHTS['003'];
    for (const source of sources.filter(item => group(item.id) === '001')) source.weight *= WEIGHTS['001'] / sum;
  }
  const total = sources.reduce((sum, source) => sum + source.weight, 0);
  const drivers = sources.map(source => ({ id: source.id, group: group(source.id), weight: source.weight / total,
    score: source.score, direction: source.direction ?? 0 }));
  const score = round(drivers.reduce((sum, driver) => sum + driver.score * driver.weight, 0));
  const bullish = new Set(drivers.filter(driver => driver.direction > 0).map(driver => driver.group));
  const bearish = new Set(drivers.filter(driver => driver.direction < 0).map(driver => driver.group));
  const conflict = bullish.size > 0 && bearish.size > 0;
  const confidence = round(clamp(sources.reduce((sum, source) => sum + source.confidence * source.weight / total, 0)
    * (conflict ? 0.7 : 1), 0, 0.94), 3);
  const direction = !conflict && confidence >= 0.65 ? (bullish.size >= 2 ? 1 : bearish.size >= 2 ? -1 : 0) : 0;
  const signal = active.length === 1 ? null : direction > 0 ? 'BUY' : direction < 0 ? 'SELL' : 'HOLD';
  const result = { mode: active.length === 1 ? 'INDIVIDUAL' : 'CONFLUENCE', score, confidence, signal, drivers,
    coincidences: bullish.size >= 2 ? [...bullish] : bearish.size >= 2 ? [...bearish] : [],
    conflicts: conflict ? [{ bullish: [...bullish], bearish: [...bearish] }] : [],
    dependency: hasTechnicalGroup ? 'Los cores 001 y 003 comparten observaciones técnicas.' : null,
    ruleVersion: 'collar-v1' };
  return available(result, [observation('Escáner v2 · confluencia', iso(asOf), 'collar-v1'),
    ...uniqueBy(sources.flatMap(source => source.evidence), item => `${item.source}|${item.observedAt}|${item.reference}`)], { score, confidence, direction });
}
