// Adaptación de la serie técnica del Core 001 a la gráfica y a su resumen en texto.
// Son funciones puras: la gráfica y la tabla salen del mismo resultado de la API.
import { payoffCollar } from './graficasCores';

const ESCALAS = [
  { clave: 'intermediate', nombre: 'intermedia', medias: 'EMA50 vs SMA200' },
  { clave: 'short', nombre: 'corta', medias: 'EMA20 vs EMA50' },
];

const formatoPrecio = valor => Number(valor).toFixed(2);
const formatoVolumen = new Intl.NumberFormat('es-MX');
const fechaMercado = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});

function bandasBollinger(velas) {
  const periodos = 20;
  if (velas.length < periodos) return [];

  const superior = [];
  const media = [];
  const inferior = [];
  for (let i = periodos - 1; i < velas.length; i++) {
    const { time } = velas[i];
    const cierres = velas.slice(i - periodos + 1, i + 1).map(vela => vela.close);
    const centro = cierres.reduce((suma, cierre) => suma + cierre, 0) / periodos;
    const varianza = cierres.reduce((suma, cierre) => suma + (cierre - centro) ** 2, 0) / periodos;
    const amplitud = 2 * Math.sqrt(varianza);
    superior.push({ time, value: centro + amplitud });
    media.push({ time, value: centro });
    inferior.push({ time, value: centro - amplitud });
  }
  return [superior, media, inferior];
}

export function prepararNivelesDelActivo(spot, collar) {
  const niveles = [];
  if (Number.isFinite(spot) && spot > 0) {
    niveles.push({ id: 'spot', capa: 'spot', etiqueta: 'Spot', precio: spot });
  }
  const datosCollar = [collar?.put?.strike, collar?.call?.strike, collar?.underlyingPrice, collar?.put?.ask, collar?.call?.bid, collar?.shares];
  const payoff = collar?.eligible && datosCollar.every(Number.isFinite) ? payoffCollar(collar) : null;
  if (payoff) {
    niveles.push(
      { id: 'put', capa: 'collar', etiqueta: 'Put', precio: collar.put.strike },
      { id: 'equilibrio', capa: 'collar', etiqueta: 'Equilibrio', precio: payoff.breakEven },
      { id: 'call', capa: 'collar', etiqueta: 'Call · máx.', precio: collar.call.strike },
    );
  }
  return { niveles, payoff };
}

export function prepararEventosDelActivo(serie, cores) {
  const sesiones = [...serie.candles.map(vela => vela.time), ...(serie.upcoming ?? [])];
  const sesionesDisponibles = new Set(sesiones);
  const coreNoticias = cores?.['006']?.result;
  const titulos = coreNoticias?.events ?? coreNoticias?.headlines ?? [];
  const noticias = titulos.flatMap(noticia => {
    const instante = Date.parse(noticia.publishedAt);
    if (!noticia.headline || !Number.isFinite(instante)) return [];
    return [{ ...noticia, fecha: fechaMercado.format(instante) }];
  });

  const evento = cores?.['002']?.result?.event;
  let resultados = null;
  if (evento) {
    // Las fechas del proveedor son días de calendario. Se conserva su ventana completa en el texto.
    const desde = typeof evento.start === 'string' ? evento.start.slice(0, 10) : null;
    const hasta = typeof evento.end === 'string' ? evento.end.slice(0, 10) : desde;
    resultados = evento.risk !== 'UNVERIFIED' && /^\d{4}-\d{2}-\d{2}$/.test(desde)
      && Number.isFinite(Date.parse(desde)) && Number.isFinite(Date.parse(hasta)) && hasta >= desde
      ? { desde, hasta, estimado: evento.estimated === true }
      : { desde: null, hasta: null };
  }
  const diasNoticias = [...new Set(noticias.map(noticia => noticia.reaction?.session ?? noticia.fecha))]
    .filter(dia => sesionesDisponibles.has(dia));
  const diasResultados = resultados?.desde ? sesiones.filter(dia => dia >= resultados.desde && dia <= resultados.hasta) : [];
  return {
    noticias,
    resultados,
    diasNoticias,
    ventanaResultados: diasResultados.length ? { desde: diasResultados[0], hasta: diasResultados.at(-1) } : null,
  };
}

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
    volumen: serie.candles.flatMap(({ time, open, close, volume }) => (
      Number.isFinite(volume) && volume >= 0
        ? [{ time, value: volume, direccion: close >= open ? 'alza' : 'baja' }]
        : []
    )),
    futuras: (serie.upcoming ?? []).filter(time => time > ultima && time <= finVentanas).map(time => ({ time })),
    medias: [
      { clave: 'sma200', etiqueta: 'SMA200', puntos: serie.movingAverages.sma200 },
      { clave: 'ema50', etiqueta: 'EMA50', puntos: serie.movingAverages.ema50 },
      { clave: 'ema20', etiqueta: 'EMA20', puntos: serie.movingAverages.ema20 },
    ],
    bollinger: bandasBollinger(serie.candles),
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
  const ultima = serie.candles.at(-1);
  const volumen = ultima?.volume;
  const { primary, intermediate, short } = serie.scales;
  return [
    `${serie.symbol}: ${serie.candles.length} velas diarias del ${primera} al ${ultima?.time} (${serie.source}).`,
    ...(Number.isFinite(volumen) && volumen >= 0
      ? [`Volumen de la última sesión: ${formatoVolumen.format(volumen)} acciones.`]
      : []),
    `Tendencia ${escalaEnTexto('primaria', primary)}; ${escalaEnTexto('intermedia', intermediate)}; ${escalaEnTexto('corta', short)}.`,
    `${nivelEnTexto('Soporte', serie.support[0])} ${nivelEnTexto('Resistencia', serie.resistance[0])}`,
    ...ESCALAS.slice().reverse().map(({ clave, nombre, medias }) => proyeccionEnTexto(nombre, medias, serie.projections?.[clave])),
  ];
}
