// Adaptación de la serie técnica del Core 001 a la gráfica y a su resumen en texto.
// Son funciones puras: la gráfica y la tabla salen del mismo resultado de la API.

const ESCALAS = [
  { clave: 'intermediate', nombre: 'intermedia', medias: 'EMA50 vs SMA200' },
  { clave: 'short', nombre: 'corta', medias: 'EMA20 vs EMA50' },
];

const formatoPrecio = valor => Number(valor).toFixed(2);

export async function cargarSerieTecnica({ apiBase = '', token, symbol, signal }) {
  let respuesta;
  try {
    respuesta = await fetch(`${apiBase}/api/v2/strategy-screener/technical/${encodeURIComponent(symbol)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new Error('No se pudo conectar con la API para pedir la serie técnica.');
  }
  let cuerpo = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    cuerpo = null;
  }
  if (!respuesta.ok) {
    if (respuesta.status === 404 && !cuerpo?.message) throw new Error('Este backend aún no publica la serie técnica del Core 001.');
    throw new Error(cuerpo?.message || `La API respondió ${respuesta.status} sin detalle.`);
  }
  return cuerpo;
}

export function prepararGraficaTecnica(serie) {
  const ultima = serie.candles.at(-1)?.time ?? '';
  const niveles = [
    ...serie.support.map((nivel, i) => ({ ...nivel, tipo: 'support', etiqueta: `S${i + 1}` })),
    ...serie.resistance.map((nivel, i) => ({ ...nivel, tipo: 'resistance', etiqueta: `R${i + 1}` })),
  ];
  const ventanas = ESCALAS.flatMap(({ clave, nombre }) => {
    const proyeccion = serie.projections?.[clave];
    if (!proyeccion?.projected || !proyeccion.window) return [];
    return [{
      escala: clave, etiqueta: `Proyección ${nombre}`, direction: proyeccion.direction,
      from: proyeccion.window.from, to: proyeccion.window.to, openEnded: proyeccion.openEnded,
    }];
  });
  const tramos = ESCALAS.flatMap(({ clave }, fila) => (serie.segments?.[clave] ?? []).map(tramo => ({ ...tramo, escala: clave, fila })));
  // Solo se reserva espacio futuro hasta el fin de la última ventana; sin ventana, la gráfica termina en la última vela.
  const finVentanas = ventanas.reduce((fin, ventana) => (ventana.to > fin ? ventana.to : fin), '');
  return {
    velas: serie.candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })),
    futuras: (serie.upcoming ?? []).filter(time => time > ultima && time <= finVentanas).map(time => ({ time })),
    medias: [
      { clave: 'sma200', etiqueta: 'SMA200', puntos: serie.movingAverages.sma200 },
      { clave: 'ema50', etiqueta: 'EMA50', puntos: serie.movingAverages.ema50 },
      { clave: 'ema20', etiqueta: 'EMA20', puntos: serie.movingAverages.ema20 },
    ],
    niveles,
    ventanas,
    tramos,
  };
}

function escalaEnTexto(nombre, escala) {
  if (!escala?.available) return `${nombre} no disponible (${escala?.reason ?? 'sin datos'})`;
  return `${nombre} ${escala.direction} desde ${escala.since}`;
}

function precisionEnTexto(accuracy) {
  if (!accuracy?.cases) return 'sin cruces previos para medir la precisión';
  const texto = `precisión histórica ${Math.round(accuracy.hitRate * 100)} % en ${accuracy.cases} casos`;
  return accuracy.insufficientSample ? `${texto} (muestra insuficiente)` : texto;
}

function proyeccionEnTexto(nombre, medias, proyeccion) {
  const titulo = `Proyección ${nombre} (${medias})`;
  if (!proyeccion?.available) return `${titulo}: no disponible. ${proyeccion?.reason ?? ''}`.trim();
  if (!proyeccion.projected) return `${titulo}: ${proyeccion.reason}`;
  const ventana = proyeccion.window
    ? `entre ${proyeccion.window.from} y ${proyeccion.window.to}${proyeccion.openEnded ? ' o después' : ''}`
    : `en ${proyeccion.sessions.from} a ${proyeccion.sessions.to} sesiones (${proyeccion.windowReason})`;
  return `${titulo}: cambio a ${proyeccion.direction} ${ventana}; ${precisionEnTexto(proyeccion.accuracy)}.`;
}

function nivelEnTexto(nombre, nivel) {
  return nivel ? `${nombre} principal: ${formatoPrecio(nivel.price)} (${nivel.touches} toques).` : `Sin ${nombre.toLowerCase()} dentro de ±20 % del precio.`;
}

export function resumenTecnico(serie) {
  const primera = serie.candles[0]?.time;
  const ultima = serie.candles.at(-1)?.time;
  const { primary, intermediate, short } = serie.scales;
  return [
    `${serie.symbol}: ${serie.candles.length} velas diarias del ${primera} al ${ultima} (${serie.source}).`,
    `Tendencia ${escalaEnTexto('primaria', primary)}; ${escalaEnTexto('intermedia', intermediate)}; ${escalaEnTexto('corta', short)}.`,
    `${nivelEnTexto('Soporte', serie.support[0])} ${nivelEnTexto('Resistencia', serie.resistance[0])}`,
    ...ESCALAS.slice().reverse().map(({ clave, nombre, medias }) => proyeccionEnTexto(nombre, medias, serie.projections?.[clave])),
  ];
}
