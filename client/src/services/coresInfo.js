// Descriptor estático de cada core ("Cómo se calcula") y textos de participación y datos clave para la consulta por core.
// Está alineado con docs/EXPLICACION_CORES_Y_RANKING.md; si cambia un cálculo, se actualizan ambos.

export const CORES_INFO = {
  '001': {
    nombre: 'Técnico',
    fuentes: ['Velas cerradas de Alpaca Market Data IEX'],
    ventanas: 'Velas diarias de dos años (unas 500 sesiones), 1 hora (35 días) y 15 minutos (24 días); mínimo 60 velas por marco.',
    calculo: 'Tendencia (EMA20, EMA50, ADX), momentum (RSI 14, MACD 12/26/9, ROC 10) y rupturas con volumen relativo en tres marcos. Puntaje = 68 + 0.28 × bias. Además: soportes y resistencias puntuados, tendencias en tres escalas con fecha de confirmación y una ventana proyectada informativa que no entra al puntaje.',
    peso: 'Peso base 30. Si también está Señales directas, ambos comparten el bloque técnico: 001 pasa a 18 y 003 a 12.',
    participa: 'Entra a la confluencia cuando está seleccionado. Si solo está seleccionado Señales directas, se calcula como dependencia y no pondera.',
  },
  '002': {
    nombre: 'Fundamental',
    fuentes: ['SEC EDGAR (estados 10-K o 20-F en XBRL)', 'Webull (ventana de próximos resultados)'],
    ventanas: 'Los dos últimos ejercicios fiscales consecutivos.',
    calculo: 'Altman Z mide la salud financiera (los umbrales son cortes de decisión, no un techo: un Z alto sigue siendo zona segura) y Piotroski la calidad contable (9 pruebas, mínimo 6 válidas, 20 % del puntaje). Clasifica VIABLE / MARGINAL / NO_VIABLE / UNKNOWN y reporta el riesgo por resultados sin cambiar el puntaje. La vista visual del modal detalla umbrales y pruebas.',
    peso: '20 pts base (25 % efectivo con los 5 cores activos). Solo entra a la confluencia si el checkbox está marcado.',
    participa: 'Siempre se calcula como filtro GATE: veta MARGINAL y NO_VIABLE aunque esté desmarcado y oculta su Collar; no suma puntaje.',
  },
  '003': {
    nombre: 'Señales directas',
    fuentes: ['Resultado del Core 001', 'Riesgo de evento del Core 002'],
    ventanas: 'Las mismas del Core 001 y la fecha de próximos resultados.',
    calculo: 'Emite BUY o SELL si las tendencias diaria y horaria confirman la dirección del 001 con |bias| ≥ 45; con resultados a 7 días o menos fuerza HOLD y resta 20 puntos. Puntaje = 65 + lado × |bias| × 0.3.',
    peso: 'Peso base 20 (12 si también está Técnico).',
    participa: 'Entra a la confluencia cuando está seleccionado; requiere calcular el Core 001.',
  },
  '004': {
    nombre: 'Estrategia de opciones',
    fuentes: ['Contratos de Alpaca', 'Cotizaciones de opciones de Webull'],
    ventanas: 'Vencimientos cercanos al horizonte elegido (30, 45 o 60 días) y strikes entre 88 % y 112 % del precio.',
    calculo: 'Busca un Put y un Call OTM líquidos del mismo vencimiento (spread ≤ 35 %, interés abierto ≥ 10, volumen ≥ 1) con costo base entre ambos strikes, y calcula pérdida máxima, ganancia máxima y punto de equilibrio con ask y bid observados.',
    peso: 'No pondera.',
    participa: 'Siempre activo como filtro de ejecutabilidad: sin un collar compatible, la empresa sale del ranking. Solo se consulta para empresas VIABLE.',
  },
  '005': {
    nombre: 'Institucional',
    fuentes: ['Ticks de opciones de Webull', 'SEC EDGAR 13F-HR'],
    ventanas: 'Los 2 contratos con más volumen del día (hasta 120 ticks cada uno) y el 13F más reciente de hasta 190 días.',
    calculo: 'Estima la presión direccional por el lado agresor de los ticks, marca zonas de actividad por contrato y agrega el contexto de tenencias 13F.',
    peso: 'Peso base 15.',
    participa: 'Entra a la confluencia cuando está seleccionado; si no, no se calcula.',
  },
  '006': {
    nombre: 'Noticias',
    fuentes: ['Alpaca News', 'SEC EDGAR (8-K, ítems 5.02 y 2.02)', 'Velas de Alpaca IEX para la reacción de mercado'],
    ventanas: '7 días para el puntaje y hasta 15 días de contexto.',
    calculo: 'Reconoce cambios directivos, investigaciones y otras señales financieras. Pondera por relevancia y antigüedad, y toma las 8 señales recientes de mayor impacto absoluto. Puntaje = 66 + 0.28 × impacto. La reacción de mercado se muestra en el detalle del evento.',
    peso: 'Peso base 15.',
    participa: 'Entra a la confluencia cuando está seleccionado; si no, no se calcula.',
  },
  '007': {
    nombre: 'Confluencia',
    fuentes: ['Puntajes de los cores seleccionados'],
    ventanas: 'Las de cada core seleccionado.',
    calculo: 'Normaliza los pesos de los cores seleccionados y suma puntaje × peso. La confianza baja 30 % si hay grupos con sesgos opuestos; con dos o más grupos coincidentes emite BUY o SELL.',
    peso: 'No tiene peso propio: es el puntaje con el que se ordena el ranking.',
    participa: 'Siempre se calcula como síntesis de los cores seleccionados.',
  },
};

const STATUS = { AVAILABLE: 'Disponible', PARTIAL: 'Parcial', UNAVAILABLE: 'Datos insuficientes', NOT_SELECTED: 'Sin seleccionar' };
const TENDENCIA = { UP: 'Alcista', DOWN: 'Bajista', SIDEWAYS: 'Lateral' };
const porcentaje = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const numero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const formato = valor => (Number.isFinite(valor) ? numero.format(valor) : 'Sin datos');

export const estadoCore = core => STATUS[core?.status] ?? 'Sin datos';

export function participacion(id, core) {
  switch (core?.role) {
    case 'CONFLUENCE':
      return Number.isFinite(core.effectiveWeight)
        ? `Confluencia · ${porcentaje.format(core.effectiveWeight * 100)} %`
        : 'Seleccionado, sin puntaje combinado';
    case 'GATE':
      return id === '004'
        ? 'Filtro de ejecutabilidad del collar; no pondera'
        : 'Filtro de viabilidad; no entra a la confluencia';
    case 'DEPENDENCY':
      return 'Calculado como dependencia; no entra a la confluencia';
    case 'SYNTHESIS':
      return 'Síntesis de los cores seleccionados';
    case 'NOT_COMPUTED':
      return 'No calculado';
    default:
      return 'Sin dato de participación (versión anterior de la API)';
  }
}

export function datosClave(id, core) {
  const r = core?.result;
  if (!r) return core?.reason ?? estadoCore(core);
  switch (id) {
    case '001':
      return `${TENDENCIA[r.trend] ?? r.trend} · RSI ${formato(r.timeframes?.daily?.rsi)} · ADX ${formato(r.timeframes?.daily?.adx)}`;
    case '002':
      return `${r.classification} · Altman ${formato(r.altman?.value)} · Piotroski ${r.piotroski?.passed}/${r.piotroski?.evaluated}`
        + (r.risk === 'UNVERIFIED' ? ' · Earnings sin verificar' : '');
    case '003':
      return `${r.signal} · ${r.rule}` + (r.risk === 'UNVERIFIED' ? ' · Earnings sin verificar' : '');
    case '004':
      return r.eligible
        ? `Put ${r.put.strike} / Call ${r.call.strike} · ${r.expiration} · pérdida máx. ${formato(r.maxLoss)} USD`
        : r.reason;
    case '005':
      return `${r.direction} · fuerza ${formato(r.strength)}`;
    case '006':
      return `${r.sentiment} · impacto ${formato(r.impact)} · ${r.observed} titulares`;
    default:
      return `${r.signal ?? 'Evaluación individual'} · confianza ${formato(r.confidence)}`;
  }
}

// Candidatos en orden de ranking y después las empresas excluidas: todas las evaluadas.
export const empresasEvaluadas = data => [...(data?.candidates ?? []), ...(data?.excluded ?? [])];
