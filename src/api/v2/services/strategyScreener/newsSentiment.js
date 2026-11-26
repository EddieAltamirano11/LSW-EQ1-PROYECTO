const PATRON_POSITIVO = /\b(?:beats? (?:earnings |revenue )?(?:estimates|expectations)|raises? (?:its )?(?:guidance|outlook)|upgrades? (?:to|from)|record (?:revenue|profit)|wins? (?:an? )?(?:contract|approval)|strong (?:earnings|growth))\b/gi;
const PATRON_NEGATIVO = /\b(?:miss(?:es|ed)? (?:earnings |revenue )?(?:estimates|expectations)|cuts? (?:its )?(?:guidance|outlook)|downgrades? (?:to|from)|profit warning|files? for bankruptcy|antitrust (?:probe|lawsuit)|regulatory (?:probe|fine)|recalls? (?:its|the))\b/gi;

const RAZON_SOCIAL = /(?:incorporated|inc|corp(?:oration)?|ltd|limited|plc|llc)\b\.?/;
const IMPORTE = /(?:US\$|\$|USD\s*|€|EUR\s*|£|GBP\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/;
const CONECTOR = /\s*,?\s*(?:(?:is|was|has been)\s+)?(?:(?:up|down|raised|cut|lowered|revised|adjusted|updated|raising|lifting|boosting|increasing|cutting|lowering|reducing|slashing|revising|adjusting|updating)\s+(?:it\s+)?)?/;
const ANTERIOR_Y_NUEVO = new RegExp(String.raw`^${CONECTOR.source}from\s+(${IMPORTE.source})\s+to\s+(${IMPORTE.source})(?![\d%]|[.,]\d)`, 'i');
const NUEVO_Y_ANTERIOR = new RegExp(String.raw`^${CONECTOR.source}(?:to|at)\s+(${IMPORTE.source}),?\s+(?:(?:up|down)\s+)?from\s+(?:(?:its|the)\s+)?(?:previous\s+)?(?:target\s+of\s+)?(${IMPORTE.source})(?![\d%]|[.,]\d)`, 'i');

const ALZA_ANTES = /\b(?:raises?|raised|lifts?|lifted|boosts?|boosted|increases?|increased)\s+(?:(?:its|their|the)\s+)?$/i;
const BAJA_ANTES = /\b(?:cuts?|lowers?|lowered|reduces?|reduced|slashes|slashed)\s+(?:(?:its|their|the)\s+)?$/i;
const ALZA_DESPUES = /^\s*(?:(?:is|was|has been)\s+)?(?:raised|lifted|boosted|increased)\b/i;
const BAJA_DESPUES = /^\s*(?:(?:is|was|has been)\s+)?(?:cut|lowered|reduced|slashed)\b/i;
const ACCION_INCIERTA = /\b(?:not|never|could|may|might|would|plans to|expects to)\s+(?:\w+\s+)?(?:(?:its|their|the)\s+)?$/i;

export function patronEmpresa({ symbol, companyName } = {}) {
  const nombre = companyName?.trim().replace(new RegExp(String.raw`[,\s]+${RAZON_SOCIAL.source}$`, 'i'), '');
  const nombres = [...new Set([symbol, nombre, nombre?.replace(/\.com$/i, '')])]
    .filter(valor => valor?.length > 1);
  const literales = (nombres.length ? nombres : ['company']).map(valor => valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return String.raw`\b(?:${literales.join('|')})\b`;
}

function interpretarImporte(importe) {
  const [, moneda, monto] = importe.match(/^(US\$|\$|USD|€|EUR|£|GBP)?\s*([\d,.]+)$/i);
  const codigo = { $: 'USD', 'US$': 'USD', '€': 'EUR', '£': 'GBP' }[moneda?.toUpperCase()] ?? moneda?.toUpperCase();
  return { codigo, valor: Number(monto.replace(/,/g, '')) };
}

function compararObjetivos(anterior, nuevo) {
  const previo = interpretarImporte(anterior);
  const actual = interpretarImporte(nuevo);
  return previo.codigo && actual.codigo && previo.codigo !== actual.codigo ? 0 : Math.sign(actual.valor - previo.valor);
}

function direccionPrecioObjetivo(texto, objetivo) {
  let balance = 0;
  for (const coincidencia of texto.matchAll(objetivo)) {
    const antes = texto.slice(0, coincidencia.index);
    if (ACCION_INCIERTA.test(antes)) continue;
    const despues = texto.slice(coincidencia.index + coincidencia[0].length);
    const anteriorYNuevo = despues.match(ANTERIOR_Y_NUEVO);
    const nuevoYAnterior = despues.match(NUEVO_Y_ANTERIOR);
    if (anteriorYNuevo || nuevoYAnterior) {
      balance += anteriorYNuevo
        ? compararObjetivos(anteriorYNuevo[1], anteriorYNuevo[2])
        : compararObjetivos(nuevoYAnterior[2], nuevoYAnterior[1]);
      continue;
    }
    balance += Number(ALZA_ANTES.test(antes) || ALZA_DESPUES.test(despues))
      - Number(BAJA_ANTES.test(antes) || BAJA_DESPUES.test(despues));
  }
  return Math.sign(balance);
}

export function crearClasificadorNoticias(activo) {
  const empresa = patronEmpresa(activo);
  const sujeto = String.raw`${empresa}\s+(?:has\s+)?`;
  const verboContrato = /(?:secur(?:es?|ed)|(?:is |was |has been )awarded|enters? into|entered into|signs?|signed)/;
  const detalleContrato = /(?:(?!(?:no|and|but|while|option|conditional|potential|preliminary|proposed|prospective)\b)[\w$%,-]+(?:\.\d+)?\s+){0,8}/;
  const contrato = new RegExp(String.raw`${sujeto}${verboContrato.source}\s+${detalleContrato.source}contracts?\b`, 'i');
  const caidaReportada = /(?:suffers?|suffered|experiences?|experienced|reports?|reported)\s+(?:an?\s+)?(?:(?:major|significant|widespread)\s+)?(?:outage|service outage|service disruption)\b/;
  const codigoRojo = /(?:declares?|declared)\s+['"“‘]?code red['"”’]?\s+(?:following|after)\s+(?:an?\s+)?(?:(?:historic|major|significant|service)\s+){0,2}outage\b/;
  const interrupcion = new RegExp([
    String.raw`${sujeto}(?:${caidaReportada.source}|${codigoRojo.source})`,
    String.raw`${empresa}(?:['’]s)?\s+(?:outage|service outage|service disruption)\s+(?:affects?|impacts?)\s+(?:its\s+)?(?:customers|users)\b`,
  ].join('|'), 'i');
  const restablecimiento = new RegExp([
    String.raw`${sujeto}(?:restores?|restored)\s+(?:its\s+)?(?:services?|operations)\b`,
    String.raw`${empresa}(?:['’]s)?\s+services?\s+(?:(?:is|are|was|were|have been|has been)\s+)?(?:fully\s+)?restored\b`,
  ].join('|'), 'i');
  const falloAdverso = new RegExp(String.raw`\b(?:court|judge)\s+(?:has\s+)?(?:rules?|ruled)\s+against\s+${empresa}(?!['’]s\b)`, 'i');
  const identidad = String.raw`${empresa}(?:,?\s+${RAZON_SOCIAL.source})?(?:\s*\([A-Z][A-Z0-9.-]+\))?`;
  const objetivo = new RegExp(String.raw`${identidad}(?:['’]s)?\s+price targets?\b|\bprice targets?\s+(?:for|on|of)\s+${identidad}`, 'gi');
  const revisionAnalistas = new RegExp(String.raw`${empresa}\s+(?:receives?|received|gets?|got)\s+(?:analyst\s+)?(upgrades?|downgrades?)\b`, 'i');

  return articulo => {
    const titular = articulo.headline;
    const resumen = String(articulo.summary ?? '');
    const servicioRestablecido = restablecimiento.test(titular) || restablecimiento.test(resumen);
    const contar = texto => (texto.match(PATRON_POSITIVO)?.length ?? 0) - (texto.match(PATRON_NEGATIVO)?.length ?? 0)
      + Number(contrato.test(texto))
      - Number(!servicioRestablecido && interrupcion.test(texto))
      - Number(falloAdverso.test(texto))
      + direccionPrecioObjetivo(texto, objetivo)
      + ({ upgrade: 1, upgrades: 1, downgrade: -1, downgrades: -1 }[texto.match(revisionAnalistas)?.[1].toLowerCase()] ?? 0);
    return contar(titular) + 0.5 * contar(resumen);
  };
}
