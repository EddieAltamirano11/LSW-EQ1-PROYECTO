import { DAY, available, iso, observation, partial, time, unavailable, uniqueBy, within } from './observations.js';
import { clamp, round } from './technicalCore.js';
import { crearClasificadorNoticias, patronEmpresa } from './newsSentiment.js';
import { agruparEventosConfirmados, clasificarEventoNoticia, DIAS_CONTEXTO_NOTICIAS, DIAS_PUNTAJE_NOTICIAS } from './newsEvents.js';

export const CORES_SELECCIONABLES = ['001', '002', '003', '005', '006'];
const PESOS_BASE = { '001': 30, '002': 20, '003': 20, '005': 15, '006': 15 };
const PATRONES_EVENTOS = [
  ['EARNINGS', /\b(?:earnings|quarterly results|guidance)\b/i],
  ['M&A', /\b(?:acqui(?:res|sition)|merger|takeover)\b/i],
  ['REGULATORY', /\b(?:sec probe|lawsuit|regulatory|antitrust|recall)\b/i],
  ['MACRO', /\b(?:federal reserve|interest rate|inflation|tariffs?)\b/i],
];

function normalizarTitular(titular) {
  return titular.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function enlaceDeArticulo(url) {
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) return null;
  try {
    const enlace = new URL(url);
    // Las plataformas de cotizaciones pueden compartir una URL entre varios artículos.
    if (/^\/(?:stocks?|quotes?|symbols?|tickers?)(?:\/|$)/i.test(enlace.pathname)) return null;
    enlace.hash = '';
    for (const clave of [...enlace.searchParams.keys()]) {
      if (/^(?:utm_.+|gclid|fbclid)$/i.test(clave)) enlace.searchParams.delete(clave);
    }
    enlace.searchParams.sort();
    return enlace.href;
  } catch {
    return null;
  }
}

export function calcularCoreNoticias(noticias, fechaCorte, activo, reportes = {}, errorNoticias) {
  const oficiales = reportes.value?.articles ?? [];
  const inicioPuntaje = fechaCorte - DIAS_PUNTAJE_NOTICIAS * DAY;
  if (!noticias && !oficiales.some(articulo => within(articulo.created_at, inicioPuntaje, fechaCorte))) {
    return errorNoticias ?? unavailable('No se pudo verificar la ventana de noticias.');
  }
  const clasificarSentimiento = crearClasificadorNoticias(activo);
  const empresa = new RegExp(patronEmpresa(activo), 'i');
  const inicioContexto = fechaCorte - DIAS_CONTEXTO_NOTICIAS * DAY;
  const articulosOrdenados = [...(noticias?.articles ?? []), ...oficiales]
    .filter(articulo => within(articulo.created_at, inicioContexto, fechaCorte))
    .sort((a, b) => time(b.created_at) - time(a.created_at) || String(a.id).localeCompare(String(b.id)));
  const identificadoresVistos = new Set();
  const titularesVistos = new Set();
  const enlacesVistos = new Set();
  const articulosClasificados = [];
  for (const articulo of articulosOrdenados) {
    const titularNormalizado = normalizarTitular(articulo.headline);
    const identificador = articulo.id == null ? null : `${articulo.source ?? 'Alpaca News'}:${articulo.id}`;
    const oficial = articulo.event?.state === 'CONFIRMED';
    const enlace = !oficial && enlaceDeArticulo(articulo.url);
    const titularSinFirma = normalizarTitular(articulo.headline.replace(/\s(?:[-–—|])\s(?:Reuters|Bloomberg|GlobeNewswire|Business Wire|PR Newswire)$/i, ''));
    const claveEnlace = enlace && `${enlace}\n${titularSinFirma}`;
    if (!titularNormalizado || (identificador && identificadoresVistos.has(identificador))
      || (!oficial && titularesVistos.has(titularNormalizado))
      || (claveEnlace && enlacesVistos.has(claveEnlace))) continue;
    if (identificador) identificadoresVistos.add(identificador);
    if (claveEnlace) enlacesVistos.add(claveEnlace);
    if (!oficial) titularesVistos.add(titularNormalizado);
    const evento = clasificarEventoNoticia(articulo, empresa);
    const contenido = `${articulo.headline} ${articulo.summary ?? ''}`;
    const tipoEvento = evento?.type ?? PATRONES_EVENTOS.find(([, patron]) => patron.test(contenido))?.[0] ?? 'OTHER';
    const sentimiento = clamp(evento?.sentiment ?? clasificarSentimiento(articulo), -1, 1);
    const relevancia = 1 / Math.sqrt(Math.max(1, articulo.symbols.length));
    const factorRecencia = Math.exp(-Math.max(0, fechaCorte - time(articulo.created_at)) / (3 * DAY));
    const impacto = sentimiento * relevancia * factorRecencia * (['OTHER', 'ANALYST'].includes(tipoEvento) ? 0.6 : 1);
    const enlacePublico = typeof articulo.url === 'string' && /^https:\/\//i.test(articulo.url) ? articulo.url : null;
    const contextOnly = time(articulo.created_at) < inicioPuntaje;
    articulosClasificados.push({
      headline: articulo.headline, id: articulo.id, source: articulo.source, publishedAt: articulo.created_at,
      url: enlacePublico, type: tipoEvento, relevance: round(relevancia), impact: contextOnly ? 0 : round(impacto, 4),
      contextOnly, timeSource: articulo.timeSource ?? 'ALPACA_NEWS', ...(evento && { event: evento }),
      ...(articulo.occurredOn && { occurredOn: articulo.occurredOn }),
    });
  }
  const agrupados = agruparEventosConfirmados(articulosClasificados);
  const articulosSeleccionados = agrupados.filter(articulo => !articulo.contextOnly)
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact) || time(b.publishedAt) - time(a.publishedAt)).slice(0, 8);
  const events = [...new Set([...agrupados.filter(articulo => articulo.event), ...articulosSeleccionados])]
    .sort((a, b) => time(b.publishedAt) - time(a.publishedAt));
  const impactoTotal = round(clamp(45 * articulosSeleccionados.reduce((suma, articulo) => suma + articulo.impact, 0), -100, 100));
  const direccion = Math.abs(impactoTotal) >= 15 ? Math.sign(impactoTotal) : 0;
  const noticiasAlpaca = articulosClasificados.filter(articulo => articulo.timeSource === 'ALPACA_NEWS');
  const resultado = { impact: impactoTotal, sentiment: direccion > 0 ? 'POSITIVE' : direccion < 0 ? 'NEGATIVE' : 'NEUTRAL',
    headlines: articulosSeleccionados, events, observed: noticiasAlpaca.filter(articulo => !articulo.contextOnly).length,
    contextObserved: noticiasAlpaca.length, classifier: 'Reglas de lenguaje financiero EN v3',
    limitation: 'El impacto es una estimación por frases, relevancia y antigüedad. Los titulares ambiguos conservan un sesgo neutral.' };
  const motivos = [errorNoticias?.reason, noticias?.contextReason, reportes.error?.reason].filter(Boolean);
  const evidencia = [noticias?.evidence, reportes.value?.evidence, ...(reportes.error?.evidence ?? []), ...(errorNoticias?.evidence ?? []),
    ...articulosSeleccionados.map(articulo => observation(articulo.source || 'Alpaca News', articulo.publishedAt, String(articulo.id ?? articulo.headline)))].filter(Boolean);
  const puntaje = { score: round(clamp(66 + impactoTotal * 0.28)), direction: direccion, confidence: direccion ? 0.68 : 0.5 };
  return motivos.length ? partial(resultado, motivos.join(' '), evidencia, puntaje) : available(resultado, evidencia, puntaje);
}

export function calcularCoreConfluencia(coresActivos, cores, fechaCorte) {
  const fuentes = coresActivos.map(id => ({ id, ...cores[id], weight: PESOS_BASE[id] }));
  if (fuentes.some(fuente => !Number.isFinite(fuente.score))) return unavailable('Faltan puntajes comparables de uno o más cores activos.');
  const comparteGrupoTecnico = coresActivos.includes('001') && coresActivos.includes('003');
  const obtenerGrupo = id => id === '003' ? '001' : id;
  if (comparteGrupoTecnico) {
    const sumaPesosTecnicos = PESOS_BASE['001'] + PESOS_BASE['003'];
    for (const fuente of fuentes.filter(fuente => obtenerGrupo(fuente.id) === '001')) fuente.weight *= PESOS_BASE['001'] / sumaPesosTecnicos;
  }
  const pesoTotal = fuentes.reduce((suma, fuente) => suma + fuente.weight, 0);
  const contribuciones = fuentes.map(fuente => ({ id: fuente.id, group: obtenerGrupo(fuente.id), weight: fuente.weight / pesoTotal,
    score: fuente.score, direction: fuente.direction ?? 0 }));
  const puntaje = round(contribuciones.reduce((suma, contribucion) => suma + contribucion.score * contribucion.weight, 0));
  const gruposAlcistas = new Set(contribuciones.filter(contribucion => contribucion.direction > 0).map(contribucion => contribucion.group));
  const gruposBajistas = new Set(contribuciones.filter(contribucion => contribucion.direction < 0).map(contribucion => contribucion.group));
  const hayConflicto = gruposAlcistas.size > 0 && gruposBajistas.size > 0;
  const confianza = round(clamp(fuentes.reduce((suma, fuente) => suma + fuente.confidence * fuente.weight / pesoTotal, 0)
    * (hayConflicto ? 0.7 : 1), 0, 0.94), 3);
  const direccion = !hayConflicto && confianza >= 0.65 ? (gruposAlcistas.size >= 2 ? 1 : gruposBajistas.size >= 2 ? -1 : 0) : 0;
  const senal = coresActivos.length === 1 ? null : direccion > 0 ? 'BUY' : direccion < 0 ? 'SELL' : 'HOLD';
  const resultado = { mode: coresActivos.length === 1 ? 'INDIVIDUAL' : 'CONFLUENCE', score: puntaje, confidence: confianza,
    signal: senal, drivers: contribuciones,
    coincidences: gruposAlcistas.size >= 2 ? [...gruposAlcistas] : gruposBajistas.size >= 2 ? [...gruposBajistas] : [],
    conflicts: hayConflicto ? [{ bullish: [...gruposAlcistas], bearish: [...gruposBajistas] }] : [],
    dependency: comparteGrupoTecnico ? 'Los cores 001 y 003 comparten observaciones técnicas.' : null,
    ruleVersion: 'collar-v1' };
  return available(resultado, [observation('Escáner v2 · confluencia', iso(fechaCorte), 'collar-v1'),
    ...uniqueBy(fuentes.flatMap(fuente => fuente.evidence), evidencia => `${evidencia.source}|${evidencia.observedAt}|${evidencia.reference}`)],
  { score: puntaje, confidence: confianza, direction: direccion });
}
