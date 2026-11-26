import { DAY, time } from './observations.js';

const CEO = /\b(?:ceo|chief executive officer)\b/i;
const RIESGO_ABIERTO = /\b(?:investigat(?:es?|ing|ion)|probes?|subpoenas?)\b/i;
const RETORNO = /\b(?:reinstates?|reinstated|reappoints?|reappointed|returns? as|returned as)\b/i;
const SALIDA = /\b(?:resigns?|resigned|steps? down|stepped down|announces? (?:its )?(?:ceo )?(?:resignation|departure))\b/i;
const INTERINO = /\b(?:appoints?|appointed|names?|named)\b.{0,100}\b(?:interim|acting)\s+(?:ceo|chief executive officer)\b/i;
const PROPUESTA = /\b(?:could|would|might|may|reportedly|possible|potential|proposed|pushes for|calls for|plans to|expected to)\b/i;

export const DIAS_CONTEXTO_NOTICIAS = 15;
export const DIAS_PUNTAJE_NOTICIAS = 7;

export const liderazgo = {
  REINSTATEMENT: { type: 'LEADERSHIP', action: 'REINSTATEMENT', sentiment: 0.6, label: 'Reincorporación del CEO' },
  DEPARTURE: { type: 'LEADERSHIP', action: 'DEPARTURE', sentiment: -0.6, label: 'Salida del CEO' },
  INTERIM: { type: 'LEADERSHIP', action: 'INTERIM', sentiment: 0, label: 'Nombramiento de CEO interino' },
};
export const resultadosPublicados = { type: 'EARNINGS', action: 'RESULTS', label: 'Publicación de resultados' };

export function clasificarEventoNoticia(articulo, empresa) {
  if (articulo.event) return articulo.event;
  const { headline } = articulo;
  const asociado = empresa.test(headline) || (articulo.symbols?.length === 1 && empresa.test(articulo.summary ?? ''));
  if (!asociado) return null;
  if (empresa.test(headline) && /\b(?:price target|analyst downgrades?|analyst upgrades?)\b/i.test(headline)) {
    return { type: 'ANALYST', action: 'ANALYST_REVIEW', state: 'REPORTED', label: 'Revisión de analistas' };
  }
  if (CEO.test(headline) && !PROPUESTA.test(headline)) {
    const cambio = RETORNO.test(headline) ? liderazgo.REINSTATEMENT
      : SALIDA.test(headline) ? liderazgo.DEPARTURE
      : INTERINO.test(headline) ? liderazgo.INTERIM : null;
    if (cambio) return { ...cambio, state: 'REPORTED' };
  }
  if (empresa.test(headline) && !PROPUESTA.test(headline)) {
    // La mención tiene que identificar a la emisora como destinataria o investigada.
    const afecta = new RegExp(
      String.raw`(?:\b(?:into|of|against|on|to)\s+${empresa.source}(?!['’]s\b|\s+(?:influence|supplier|partner|customer|rival|competitor)\b)|${empresa.source}\s+(?:faces?|subject to|under|is (?:subject to|under|being investigated)))`, 'i',
    );
    if (RIESGO_ABIERTO.test(headline) && afecta.test(headline)) {
      const esRequerimiento = /\bsubpoena\b/i.test(headline);
      return { type: 'REGULATORY', action: esRequerimiento ? 'SUBPOENA' : 'INVESTIGATION', state: 'OPEN',
        sentiment: -0.6, label: esRequerimiento ? 'Requerimiento de información' : 'Investigación reportada' };
    }
    if (/\b(?:export (?:controls?|restrictions?|licen[cs]es?|approvals?|compliance)|(?:licenses?|approvals?) for .*exports?)\b/i.test(headline)) {
      return { type: 'REGULATORY', action: 'EXPORT_CONTROLS', state: 'REPORTED', sentiment: 0, label: 'Controles de exportación' };
    }
  }
  if (CEO.test(headline) && /\b(?:senate|congressional)\b/i.test(headline) && /\b(?:testif\w*|testimony|hearing)\b/i.test(headline)) {
    return { type: 'REGULATORY', action: 'HEARING', state: 'SCHEDULED', sentiment: 0, label: 'Comparecencia legislativa' };
  }
  if (/\b(?:reports?|announces?|posts?)\b.{0,90}\b(?:financial results|quarterly results|earnings)\b/i.test(headline)) {
    return { ...resultadosPublicados, state: 'REPORTED' };
  }
  return null;
}

export function eventosEjecutivosDel8K(html) {
  const texto = html.replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|#160|#xA0);/gi, ' ')
    .replace(/&(?:apos|rsquo|#39|#8217|#x27|#x2019);/gi, "'").replace(/\s+/g, ' ');
  const seccion = texto.match(/\bItem\s+5\.02\b([\s\S]*?)(?=\bItem\s+\d\.\d{2}\b|\bSIGNATURE\b|$)/i)?.[1] ?? '';
  return [
    [/\breinstated\b.{1,160}?\bas\b[^;]{0,85}?\b(?:chief executive officer|ceo)\b/i, liderazgo.REINSTATEMENT],
    [/\b(?:accepted (?:the )?resignation of|resign(?:ed|s)\b).{1,180}?\bas\b[^;]{0,85}?\b(?:chief executive officer|ceo)\b/i, liderazgo.DEPARTURE],
    [/\b(?:appointed|named)\b.{1,180}?\b(?:interim|acting)\s+(?:chief executive officer|ceo)\b/i, liderazgo.INTERIM],
  ].filter(([patron]) => patron.test(seccion)).map(([, evento]) => ({ ...evento, state: 'CONFIRMED' }));
}

export function agruparEventosConfirmados(articulos) {
  // El 8-K ancla la hora. Solo se vincula cobertura del mismo hecho cercana a la publicación.
  const oficiales = articulos.filter(articulo => articulo.event?.state === 'CONFIRMED');
  const otros = [];
  const coincidencias = new Map(oficiales.map(articulo => [articulo.id, []]));
  for (const articulo of articulos) {
    if (articulo.event?.state === 'CONFIRMED') continue;
    const candidato = articulo.event && oficiales.find(oficial => oficial.event.action === articulo.event.action
      && Math.abs(time(oficial.publishedAt) - time(articulo.publishedAt)) <= 2 * DAY);
    if (candidato) coincidencias.get(candidato.id).push(articulo);
    else otros.push(articulo);
  }
  return [...otros, ...oficiales.map(articulo => {
    const cobertura = coincidencias.get(articulo.id);
    // El ítem 2.02 confirma la publicación. El signo de una sorpresa se obtiene de la cobertura.
    const conImpacto = articulo.event.action === 'RESULTS' && !articulo.contextOnly
      ? cobertura.reduce((mayor, noticia) => Math.abs(noticia.impact) > Math.abs(mayor) ? noticia.impact : mayor, articulo.impact)
      : articulo.impact;
    return { ...articulo, impact: conImpacto, related: cobertura.map(({ id, headline, publishedAt, source, url }) =>
      ({ id, headline, publishedAt, source, url })) };
  })];
}
