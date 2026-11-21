// Observaciones de mercado compartidas por el escáner (v2) y las coberturas (v1): errores de fuente, peticiones y paginación.
export const DAY = 86_400_000;
export const MINUTE = 60_000;

export class SourceError extends Error {
  constructor(source, reason) {
    super(`${source}: ${reason}`);
    this.source = source;
    this.reason = reason;
  }
}

export function number(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function time(value) {
  return typeof value === 'number' ? value : Date.parse(value);
}

export function iso(value) {
  return new Date(value).toISOString();
}

export function within(value, start, end) {
  const observed = time(value);
  return observed >= start && observed <= end;
}

export function uniqueBy(items, key) {
  return [...new Map(items.map(item => [key(item), item])).values()];
}

export function observation(source, observedAt, reference, delayMinutes = 0) {
  return { source, observedAt, reference, delayMinutes };
}

export function assertObservedFeed(source, feed) {
  if (typeof feed !== 'string' || !feed || /indicative|simulat|synthetic|theoretical|reference/i.test(feed)) {
    throw new SourceError(source, 'El proveedor no entregó observaciones de mercado verificables.');
  }
}

export async function request(source, url, { headers, signal, format = 'json' } = {}) {
  const timeout = AbortSignal.timeout(8_000);
  try {
    const res = await fetch(url, {
      headers, redirect: 'error', signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!res.ok) {
      // Se conserva el cuerpo para que quien llama pueda leer la causa del proveedor (por ejemplo, símbolos inválidos).
      const error = new SourceError(source, `Respuesta HTTP ${res.status}.`);
      error.status = res.status;
      error.cuerpo = typeof res.text === 'function' ? (await res.text().catch(() => '')).slice(0, 4000) : '';
      throw error;
    }
    return await (format === 'json' ? res.json() : res.text());
  } catch (error) {
    if (error instanceof SourceError) throw error;
    throw new SourceError(source, 'La fuente no respondió con datos válidos en el tiempo disponible.');
  }
}

export async function pages(source, getPage, { maxPages = 8, limit = Infinity } = {}) {
  const items = [];
  const seen = new Set();
  let cursor;
  do {
    const page = await getPage(cursor);
    if (!Array.isArray(page.items)) throw new SourceError(source, 'El proveedor devolvió una página sin datos reconocibles.');
    items.push(...page.items);
    if (items.length >= limit) return items.slice(0, limit);
    cursor = page.cursor;
    if (!cursor) return items;
    if (seen.has(cursor)) break;
    seen.add(cursor);
  } while (seen.size < maxPages);
  throw new SourceError(source, 'La consulta superó el límite de paginación sin completar el resultado.');
}

export async function mapConcurrent(items, concurrency, fn) {
  const results = [];
  let position = 0;
  async function work() {
    while (position < items.length) {
      const index = position++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, work));
  return results;
}

export function available(result, evidence, signals = {}) {
  return { status: 'AVAILABLE', result, evidence, ...signals };
}

export function unavailable(reason, evidence = []) {
  return { status: 'UNAVAILABLE', reason, result: null, evidence };
}

export function partial(result, reason, evidence, signals = {}) {
  return { status: 'PARTIAL', result, reason, evidence, ...signals };
}

export function fromFailure(error) {
  if (!(error instanceof SourceError)) throw error;
  return unavailable(error.reason, [observation(error.source, null, null)]);
}
