import { DAY, available, iso, observation, time, unavailable, uniqueBy } from './observations.js';
import { clamp, round } from './technicalCore.js';

export const CORES_SELECCIONABLES = ['001', '002', '003', '005', '006'];
const PESOS_BASE = { '001': 30, '002': 20, '003': 20, '005': 15, '006': 15 };
const PATRON_POSITIVO = /(?:\b(?:beats? (?:earnings |revenue )?(?:estimates|expectations)|raises? (?:its )?(?:guidance|outlook)|upgrades? (?:to|from)|record (?:revenue|profit)|wins? (?:an? )?(?:contract|approval)|strong (?:earnings|growth))\b)/gi;
const PATRON_NEGATIVO = /(?:\b(?:miss(?:es|ed)? (?:earnings |revenue )?(?:estimates|expectations)|cuts? (?:its )?(?:guidance|outlook)|downgrades? (?:to|from)|profit warning|files? for bankruptcy|antitrust (?:probe|lawsuit)|regulatory (?:probe|fine)|recalls? (?:its|the))\b)/gi;
const PATRONES_EVENTOS = [
  ['EARNINGS', /\b(?:earnings|quarterly results|guidance)\b/i],
  ['M&A', /\b(?:acqui(?:res|sition)|merger|takeover)\b/i],
  ['REGULATORY', /\b(?:sec probe|lawsuit|regulatory|antitrust|recall)\b/i],
  ['MACRO', /\b(?:federal reserve|interest rate|inflation|tariffs?)\b/i],
];

function normalizarTitular(titular) {
  return titular.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

export function calcularCoreNoticias(noticias, fechaCorte) {
  if (!noticias) return unavailable('No se pudo verificar la ventana de noticias.');
  const articulosOrdenados = noticias.articles.slice().sort((a, b) => time(b.created_at) - time(a.created_at) || String(a.id).localeCompare(String(b.id)));
  const identificadoresVistos = new Set();
  const enlacesVistos = new Set();
  const titularesVistos = new Set();
  const articulosClasificados = [];
  for (const articulo of articulosOrdenados) {
    const titularNormalizado = normalizarTitular(articulo.headline);
    const identificador = articulo.id == null ? null : `${articulo.source}:${articulo.id}`;
    const enlace = articulo.url?.split('?')[0];
    if (!titularNormalizado || (identificador && identificadoresVistos.has(identificador))
      || (enlace && enlacesVistos.has(enlace)) || titularesVistos.has(titularNormalizado)) continue;
    if (identificador) identificadoresVistos.add(identificador);
    if (enlace) enlacesVistos.add(enlace);
    titularesVistos.add(titularNormalizado);
    const contenido = `${articulo.headline} ${articulo.summary ?? ''}`;
    const tipoEvento = PATRONES_EVENTOS.find(([, patron]) => patron.test(contenido))?.[0] ?? 'OTHER';
    const sentimiento = clamp((articulo.headline.match(PATRON_POSITIVO)?.length ?? 0) - (articulo.headline.match(PATRON_NEGATIVO)?.length ?? 0)
      + 0.5 * ((String(articulo.summary ?? '').match(PATRON_POSITIVO)?.length ?? 0) - (String(articulo.summary ?? '').match(PATRON_NEGATIVO)?.length ?? 0)), -1, 1);
    const relevancia = 1 / Math.sqrt(Math.max(1, articulo.symbols.length));
    const factorRecencia = Math.exp(-Math.max(0, fechaCorte - time(articulo.created_at)) / (3 * DAY));
    const impacto = sentimiento * relevancia * factorRecencia * (tipoEvento === 'OTHER' ? 0.6 : 1);
    const enlacePublico = typeof articulo.url === 'string' && /^https:\/\//i.test(articulo.url) ? articulo.url : null;
    articulosClasificados.push({ headline: articulo.headline, id: articulo.id, source: articulo.source, publishedAt: articulo.created_at,
      url: enlacePublico, type: tipoEvento, relevance: round(relevancia), impact: round(impacto, 4) });
  }
  const articulosSeleccionados = articulosClasificados.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact) || time(b.publishedAt) - time(a.publishedAt)).slice(0, 8);
  const impactoTotal = round(clamp(45 * articulosSeleccionados.reduce((suma, articulo) => suma + articulo.impact, 0), -100, 100));
  const direccion = Math.abs(impactoTotal) >= 15 ? Math.sign(impactoTotal) : 0;
  const resultado = { impact: impactoTotal, sentiment: direccion > 0 ? 'POSITIVE' : direccion < 0 ? 'NEGATIVE' : 'NEUTRAL',
    headlines: articulosSeleccionados, observed: articulosClasificados.length, classifier: 'Reglas de lenguaje financiero EN v1',
    limitation: 'El impacto es una estimación por frases, relevancia y antigüedad. Los titulares ambiguos conservan un sesgo neutral.' };
  return available(resultado, [noticias.evidence, ...articulosSeleccionados.map(articulo => observation(articulo.source || 'Alpaca News', articulo.publishedAt, String(articulo.id ?? articulo.headline)))],
    { score: round(clamp(66 + impactoTotal * 0.28)), direction: direccion, confidence: direccion ? 0.68 : 0.5 });
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
