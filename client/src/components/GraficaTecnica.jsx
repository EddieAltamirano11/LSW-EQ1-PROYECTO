import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries, LineStyle, createChart } from 'lightweight-charts';
import { ChevronDown, Layers } from 'lucide-react';
import { prepararEventosDelActivo, prepararGraficaTecnica, prepararNivelesDelActivo } from '../services/graficaTecnica';
import { NoticiaDelCore } from './coresResultados';

// Gráfica del Core 001: velas diarias, medias, bandas de soporte y resistencia, tramos de tendencia
// y ventana proyectada. Se carga de forma diferida para no crecer el bundle inicial.
// Zoom y desplazamiento como en TradingView: se activan con un clic, para no robar el scroll de la página.
// La leyenda resalta el elemento elegido: su color se intensifica y el resto se atenúa.

const COLORES = {
  alza: '#2f7d4f',
  baja: '#b4443c',
  support: '#2f7d4f',
  resistance: '#b4443c',
  ventana: '#b06d12',
  bollinger: '#677680',
  noticias: '#62569b',
  resultados: '#965732',
  precios: { spot: '#25352c', put: '#7354a6', equilibrio: '#996019', call: '#245b94' },
  medias: { sma200: '#1c2b24', ema50: '#2f6fb0', ema20: '#c07a1a' },
  tendencia: { UP: '#2f7d4f', DOWN: '#b4443c', SIDEWAYS: '#9aa59d' },
};

const conAlfa = (hex, alfa) => {
  const valor = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(valor >> 16) & 255}, ${(valor >> 8) & 255}, ${valor & 255}, ${alfa})`;
};
const COLORES_VOLUMEN = { alza: conAlfa(COLORES.alza, 0.38), baja: conAlfa(COLORES.baja, 0.38) };

// Opacidad de cada capa según la selección de la leyenda: normal, resaltada o atenuada.
const OPACIDAD = { banda: [0.13, 0.4, 0.05], ventana: [0.14, 0.38, 0.05], tramo: [1, 1, 0.3] };
const nivelDe = (clave, resaltado) => (!resaltado ? 0 : resaltado === clave ? 1 : 2);

const RANGOS = [
  { id: '6M', sesiones: 126 },
  { id: '1A', sesiones: 252 },
  { id: '2A', sesiones: Infinity },
];

const GRUPOS_DE_CAPAS = [
  {
    titulo: 'Precio y collar',
    controles: [
      { clave: 'spot', rotulo: 'Spot' },
      { clave: 'niveles', rotulo: 'Soportes y resistencias' },
      { clave: 'collar', rotulo: 'Collar' },
    ],
  },
  {
    titulo: 'Análisis y eventos',
    controles: [
      { clave: 'volumen', rotulo: 'Volumen' },
      { clave: 'medias', rotulo: 'Medias' },
      { clave: 'bollinger', rotulo: 'Bollinger (20, 2)' },
      { clave: 'tramos', rotulo: 'Tendencia' },
      { clave: 'ventana', rotulo: 'Proyección técnica' },
      { clave: 'eventos', rotulo: 'Eventos' },
    ],
  },
];
const CAPAS_INICIALES = {
  spot: true, niveles: true, volumen: true, medias: true, bollinger: false, collar: true, eventos: true, ventana: true, tramos: true,
};

const LEYENDA = [
  { clave: 'sma200', capa: 'medias', rotulo: 'SMA200', muestra: { background: COLORES.medias.sma200 } },
  { clave: 'ema50', capa: 'medias', rotulo: 'EMA50', muestra: { background: COLORES.medias.ema50 } },
  { clave: 'ema20', capa: 'medias', rotulo: 'EMA20', muestra: { background: COLORES.medias.ema20 } },
  { clave: 'support', capa: 'niveles', rotulo: 'Soporte (S1 = mayor puntaje)', muestra: { background: conAlfa(COLORES.support, 0.13), outline: `1px dotted ${COLORES.support}` } },
  { clave: 'resistance', capa: 'niveles', rotulo: 'Resistencia', muestra: { background: conAlfa(COLORES.resistance, 0.13), outline: `1px dotted ${COLORES.resistance}` } },
  { clave: 'ventana', capa: 'ventana', rotulo: 'Ventana proyectada (informativa)', muestra: { background: conAlfa(COLORES.ventana, 0.14), outline: `1px dashed ${COLORES.ventana}` } },
  { clave: 'tramos', capa: 'tramos', rotulo: 'Tramos UP / DOWN / SIDEWAYS (franja superior: intermedia; inferior: corta)', tramos: true },
];
const dinero = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// Las franjas de tramos van arriba: abajo a la izquierda está el logo de atribución de TradingView.
const ALTO_TRAMO = 5;
const ORIGEN_TRAMOS = 3;
const ORIGEN_ROTULOS = ORIGEN_TRAMOS + 2 * (ALTO_TRAMO + 2) + 4;

// Primitiva de la serie de velas: dibuja en el lienzo de la gráfica lo que la librería no trae como serie.
class CapasTecnicas {
  constructor(grafica) {
    this.grafica = grafica;
    this.enlace = null;
    this.resaltado = null;
    this.visibles = CAPAS_INICIALES;
    this.eventos = null;
    const capa = (orden, dibujar) => ({
      zOrder: () => orden,
      renderer: () => ({ draw: objetivo => objetivo.useMediaCoordinateSpace(alcance => this.enlace && dibujar(alcance)) }),
    });
    this.vistas = [capa('bottom', alcance => this.dibujarFondo(alcance)), capa('top', alcance => this.dibujarFrente(alcance))];
  }

  attached(enlace) {
    this.enlace = enlace;
  }

  detached() {
    this.enlace = null;
  }

  paneViews() {
    return this.vistas;
  }

  actualizar(clave, visibles, eventos) {
    this.resaltado = clave;
    this.visibles = visibles;
    this.eventos = eventos;
    this.enlace?.requestUpdate();
  }

  horizontal(desde, hasta) {
    const escala = this.enlace.chart.timeScale();
    const inicio = escala.timeToCoordinate(desde);
    const fin = escala.timeToCoordinate(hasta);
    if (inicio === null || fin === null) return null;
    const medio = Math.max(1, escala.options().barSpacing / 2);
    return [inicio - medio, fin + medio];
  }

  dibujarFondo({ context, mediaSize }) {
    const { series } = this.enlace;
    for (const nivel of this.visibles.niveles ? this.grafica.niveles : []) {
      const arriba = series.priceToCoordinate(nivel.upper);
      const abajo = series.priceToCoordinate(nivel.lower);
      if (arriba === null || abajo === null) continue;
      const estado = nivelDe(nivel.tipo, this.resaltado);
      const y = Math.min(arriba, abajo);
      const alto = Math.max(2, Math.abs(abajo - arriba));
      context.fillStyle = conAlfa(COLORES[nivel.tipo], OPACIDAD.banda[estado]);
      context.fillRect(0, y, mediaSize.width, alto);
      if (estado === 1) {
        context.strokeStyle = COLORES[nivel.tipo];
        context.lineWidth = 1;
        context.strokeRect(0.5, y + 0.5, mediaSize.width - 1, alto - 1);
      }
    }
    for (const ventana of this.visibles.ventana ? this.grafica.ventanas : []) {
      const x = this.horizontal(ventana.from, ventana.to);
      if (!x) continue;
      context.fillStyle = conAlfa(COLORES.ventana, OPACIDAD.ventana[nivelDe('ventana', this.resaltado)]);
      context.fillRect(x[0], 0, x[1] - x[0], mediaSize.height);
    }
    const resultados = this.eventos?.ventanaResultados;
    const x = resultados ? this.horizontal(resultados.desde, resultados.hasta) : null;
    if (x) {
      context.fillStyle = conAlfa(COLORES.resultados, 0.12);
      context.fillRect(x[0], 0, x[1] - x[0], mediaSize.height);
    }
  }

  dibujarFrente({ context, mediaSize }) {
    const estadoVentana = nivelDe('ventana', this.resaltado);
    context.save();
    context.font = '600 11px system-ui, sans-serif';
    context.textBaseline = 'top';
    const ventanas = this.visibles.ventana ? this.grafica.ventanas : [];
    ventanas.forEach((ventana, indice) => {
      const x = this.horizontal(ventana.from, ventana.to);
      if (!x) return;
      context.setLineDash([4, 3]);
      context.strokeStyle = conAlfa(COLORES.ventana, estadoVentana === 2 ? 0.35 : 1);
      context.lineWidth = estadoVentana === 1 ? 2 : 1;
      context.strokeRect(x[0] + 0.5, 0.5, x[1] - x[0] - 1, mediaSize.height - 1);
      const rotulo = `${ventana.etiqueta} · ${ventana.direction}`;
      const ancho = context.measureText(rotulo).width;
      context.fillStyle = conAlfa(COLORES.ventana, estadoVentana === 2 ? 0.35 : 1);
      context.fillText(rotulo, Math.max(4, Math.min(x[0] + 4, mediaSize.width - ancho - 4)), ORIGEN_ROTULOS + indice * 14);
    });
    context.restore();
    const estadoTramos = nivelDe('tramos', this.resaltado);
    const alto = estadoTramos === 1 ? ALTO_TRAMO + 2 : ALTO_TRAMO;
    for (const tramo of this.visibles.tramos ? this.grafica.tramos : []) {
      const x = this.horizontal(tramo.start, tramo.end);
      if (!x) continue;
      context.fillStyle = conAlfa(COLORES.tendencia[tramo.direction] ?? COLORES.tendencia.SIDEWAYS, OPACIDAD.tramo[estadoTramos]);
      context.fillRect(x[0], ORIGEN_TRAMOS + tramo.fila * (ALTO_TRAMO + 2), x[1] - x[0], alto);
    }
    if (this.eventos) this.dibujarEventos(context, mediaSize, ORIGEN_ROTULOS + ventanas.length * 14);
  }

  dibujarEventos(context, { width, height }, yResultados) {
    const escala = this.enlace.chart.timeScale();
    context.save();
    context.font = '600 11px system-ui, sans-serif';
    context.setLineDash([3, 3]);
    context.strokeStyle = conAlfa(COLORES.noticias, 0.45);
    context.fillStyle = COLORES.noticias;
    for (const fecha of this.eventos.diasNoticias) {
      const x = escala.timeToCoordinate(fecha);
      if (x === null || x < 12 || x > width - 12) continue;
      context.beginPath();
      context.moveTo(x, ORIGEN_ROTULOS);
      context.lineTo(x, height - 26);
      context.stroke();
      context.fillText('N', x - 3, height - 14);
    }
    const resultados = this.eventos.ventanaResultados;
    const limites = resultados ? this.horizontal(resultados.desde, resultados.hasta) : null;
    if (limites && limites[0] < width && limites[1] > 0) {
      const rotulo = 'Resultados';
      context.fillStyle = COLORES.resultados;
      context.textBaseline = 'top';
      context.fillText(rotulo, Math.max(4, Math.min(limites[0] + 4, width - context.measureText(rotulo).width - 4)), yResultados);
    }
    context.restore();
  }
}

function token(elemento, nombre, respaldo) {
  return getComputedStyle(elemento).getPropertyValue(nombre).trim() || respaldo;
}

function Muestra({ estilo }) {
  return <span className="inline-block h-2.5 w-4 shrink-0 rounded-sm" style={estilo} aria-hidden="true" />;
}

const INTERACCION = activa => ({
  handleScroll: { mouseWheel: activa, pressedMouseMove: activa, horzTouchDrag: activa, vertTouchDrag: false },
  handleScale: { mouseWheel: activa, pinch: activa, axisPressedMouseMove: activa, axisDoubleClickReset: activa },
});

function EventosDelActivo({ resultados, noticias, diasNoticias }) {
  let textoResultados = '';
  if (resultados) {
    if (!resultados.desde) {
      textoResultados = 'Resultados trimestrales · fecha sin verificar';
    } else if (resultados.desde !== resultados.hasta) {
      textoResultados = `Resultados trimestrales · ventana del ${resultados.desde} al ${resultados.hasta}`;
    } else {
      textoResultados = `Resultados trimestrales · ${resultados.estimado ? 'fecha estimada ' : ''}${resultados.desde}`;
    }
  }
  const tituloNoticias = noticias.length ? `Noticias (${noticias.length})${diasNoticias.length ? ' · N en la gráfica' : ''}` : '';
  if (!noticias.length) return <p className="rounded-md bg-[var(--ui-page)] px-3 py-2 text-xs text-[var(--ui-muted)]">{textoResultados}</p>;

  return (
    <details className="rounded-md bg-[var(--ui-page)] px-3 py-2 text-xs text-[var(--ui-muted)]">
      <summary className="cursor-pointer font-semibold text-[var(--ui-ink)]">{[textoResultados, tituloNoticias].filter(Boolean).join(' / ')}</summary>
      <ul className="mt-2 space-y-2">
        {noticias.map(noticia => (
          <li key={`${noticia.source}:${noticia.id ?? noticia.headline}`} className="break-words">
            <NoticiaDelCore noticia={noticia} />
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function GraficaTecnica({ serie, descripcionId, spot, cores, contenedorControles }) {
  const marcoRef = useRef(null);
  const contenedorRef = useRef(null);
  const graficaRef = useRef(null);
  const elementosRef = useRef(null);
  const nivelesId = useId();
  const capasId = useId();
  const [rango, setRango] = useState('1A');
  const [activa, setActiva] = useState(false);
  const [resaltado, setResaltado] = useState(null);
  const [visibles, setVisibles] = useState(CAPAS_INICIALES);
  const [capasAbiertas, setCapasAbiertas] = useState(false);
  const grafica = useMemo(() => prepararGraficaTecnica(serie), [serie]);
  const collar = cores?.['004']?.result;
  const { niveles, payoff } = useMemo(() => prepararNivelesDelActivo(spot, collar), [spot, collar]);
  const eventos = useMemo(() => prepararEventosDelActivo(serie, cores), [serie, cores]);
  const hayEventos = Boolean(eventos.resultados || eventos.noticias.length);
  const hayContexto = spot !== undefined || cores !== undefined;
  const disponibles = {
    spot: niveles.some(nivel => nivel.id === 'spot'),
    niveles: grafica.niveles.length > 0,
    volumen: grafica.volumen.length > 0,
    medias: grafica.medias.some(media => media.puntos.length),
    bollinger: grafica.bollinger.length > 0,
    collar: Boolean(payoff),
    eventos: hayEventos,
    ventana: grafica.ventanas.length > 0,
    tramos: grafica.tramos.length > 0,
  };
  const mostrarEventos = visibles.eventos && hayEventos;
  const leyendaVisible = LEYENDA.filter(item => visibles[item.capa] && disponibles[item.capa]);
  const resalte = leyendaVisible.find(item => item.clave === resaltado)?.clave ?? null;
  const nivelesVisibles = useMemo(() => niveles.filter(nivel => (
    nivel.capa === 'spot' ? visibles.spot : visibles.collar
  )), [niveles, visibles.spot, visibles.collar]);
  const futuras = useMemo(() => {
    const finProyeccion = grafica.futuras.at(-1)?.time;
    const fechas = [visibles.ventana ? finProyeccion : null];
    if (mostrarEventos) fechas.push(eventos.ventanaResultados?.hasta, ...eventos.diasNoticias);
    const fin = fechas.filter(Boolean).sort().at(-1);
    if (fin === finProyeccion) return grafica.futuras;
    if (!fin) return [];
    const ultimaVela = grafica.velas.at(-1)?.time;
    return (serie.upcoming ?? []).filter(time => time > ultimaVela && time <= fin).map(time => ({ time }));
  }, [grafica, serie.upcoming, visibles.ventana, mostrarEventos, eventos]);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return undefined;
    const borde = token(contenedor, '--ui-border', '#dfe6dc');
    const chart = createChart(contenedor, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: token(contenedor, '--ui-surface', '#ffffff') },
        textColor: token(contenedor, '--ui-muted', '#59685e'),
        fontFamily: getComputedStyle(contenedor).fontFamily,
      },
      grid: { vertLines: { color: borde }, horzLines: { color: borde } },
      rightPriceScale: { borderColor: borde, scaleMargins: { top: 0.12, bottom: 0.08 } },
      timeScale: { borderColor: borde, rightOffset: 2 },
      crosshair: { mode: CrosshairMode.Normal },
      ...INTERACCION(false),
      localization: { locale: 'es-MX', priceFormatter: precio => precio.toFixed(2) },
    });
    let volumen = null;
    if (grafica.volumen.length) {
      volumen = chart.addSeries(HistogramSeries, {
        priceScaleId: 'volumen',
        priceFormat: { type: 'volume' },
        priceLineVisible: false,
        lastValueVisible: false,
      });
      volumen.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      volumen.setData(grafica.volumen.map(({ time, value, direccion }) => ({
        time, value, color: COLORES_VOLUMEN[direccion],
      })));
    }
    const velas = chart.addSeries(CandlestickSeries, {
      upColor: COLORES.alza, downColor: COLORES.baja, wickUpColor: COLORES.alza, wickDownColor: COLORES.baja,
      borderVisible: false, priceLineVisible: false,
    });
    const medias = {};
    for (const media of grafica.medias) {
      medias[media.clave] = chart.addSeries(LineSeries, {
        color: COLORES.medias[media.clave], lineWidth: media.clave === 'sma200' ? 2 : 1,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      });
      medias[media.clave].setData(media.puntos);
    }
    const bollinger = grafica.bollinger.map((puntos, indice) => {
      const banda = chart.addSeries(LineSeries, {
        color: conAlfa(COLORES.bollinger, indice === 1 ? 0.45 : 0.8),
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        visible: false,
      });
      banda.setData(puntos);
      return banda;
    });
    const lineasNivel = grafica.niveles.map(nivel => ({
      tipo: nivel.tipo,
      linea: velas.createPriceLine({
        price: nivel.price, color: COLORES[nivel.tipo], lineWidth: 1, lineStyle: LineStyle.Dotted,
        axisLabelVisible: true, title: nivel.etiqueta,
      }),
    }));
    const capas = new CapasTecnicas(grafica);
    velas.attachPrimitive(capas);
    graficaRef.current = chart;
    elementosRef.current = { velas, volumen, medias, bollinger, lineasNivel, capas };
    return () => {
      graficaRef.current = null;
      elementosRef.current = null;
      chart.remove();
    };
  }, [grafica]);

  useEffect(() => {
    elementosRef.current?.velas.setData([...grafica.velas, ...futuras]);
  }, [grafica, futuras]);

  useEffect(() => {
    const velas = elementosRef.current?.velas;
    if (!velas) return undefined;
    const lineas = nivelesVisibles.map(({ id, precio, etiqueta }) => velas.createPriceLine({
      id,
      price: precio,
      title: etiqueta,
      color: COLORES.precios[id],
      lineWidth: 1,
      lineStyle: id === 'spot' ? LineStyle.Dotted : LineStyle.Dashed,
      axisLabelTextColor: '#ffffff',
    }));
    const precios = nivelesVisibles.map(nivel => nivel.precio);
    const spotVisible = nivelesVisibles.find(nivel => nivel.id === 'spot')?.precio;
    const ultimoCierre = grafica.velas.at(-1)?.close;
    velas.applyOptions({
      lastValueVisible: spotVisible === undefined || ultimoCierre?.toFixed(2) !== spotVisible.toFixed(2),
      autoscaleInfoProvider: original => {
        const info = original();
        if (!info?.priceRange || !precios.length) return info;
        const { minValue, maxValue } = info.priceRange;
        return { ...info, priceRange: { minValue: Math.min(minValue, ...precios), maxValue: Math.max(maxValue, ...precios) } };
      },
    });
    return () => {
      if (elementosRef.current?.velas === velas) lineas.forEach(linea => velas.removePriceLine(linea));
    };
  }, [grafica, nivelesVisibles]);

  // Resaltado de la leyenda: el elemento elegido se intensifica y los demás se atenúan.
  useEffect(() => {
    const elementos = elementosRef.current;
    if (!elementos) return;
    const { velas, volumen, medias, bollinger, lineasNivel, capas } = elementos;
    const atenuar = Boolean(resalte);
    velas.applyOptions({
      upColor: conAlfa(COLORES.alza, atenuar ? 0.3 : 1), downColor: conAlfa(COLORES.baja, atenuar ? 0.3 : 1),
      wickUpColor: conAlfa(COLORES.alza, atenuar ? 0.3 : 1), wickDownColor: conAlfa(COLORES.baja, atenuar ? 0.3 : 1),
    });
    for (const [clave, serieMedia] of Object.entries(medias)) {
      const elegida = resalte === clave;
      serieMedia.applyOptions({
        visible: visibles.medias,
        color: conAlfa(COLORES.medias[clave], !atenuar || elegida ? 1 : 0.2),
        lineWidth: elegida ? 4 : clave === 'sma200' ? 2 : 1,
      });
    }
    volumen?.applyOptions({ visible: visibles.volumen });
    bollinger.forEach(banda => banda.applyOptions({ visible: visibles.bollinger }));
    for (const { tipo, linea } of lineasNivel) {
      const elegida = resalte === tipo;
      linea.applyOptions({
        lineVisible: visibles.niveles,
        axisLabelVisible: visibles.niveles,
        color: conAlfa(COLORES[tipo], !atenuar || elegida ? 1 : 0.25),
        lineWidth: elegida ? 2 : 1,
        lineStyle: elegida ? LineStyle.Solid : LineStyle.Dotted,
      });
    }
    capas.actualizar(resalte, visibles, mostrarEventos ? eventos : null);
  }, [resalte, grafica, visibles, mostrarEventos, eventos]);

  // Zoom y desplazamiento solo mientras la gráfica está activa (como el widget de TradingView del panel).
  useEffect(() => {
    graficaRef.current?.applyOptions(INTERACCION(activa));
    if (!activa) return undefined;
    const fuera = evento => {
      if (marcoRef.current && !marcoRef.current.contains(evento.target)) setActiva(false);
    };
    window.addEventListener('mousedown', fuera);
    window.addEventListener('touchstart', fuera, { passive: true });
    return () => {
      window.removeEventListener('mousedown', fuera);
      window.removeEventListener('touchstart', fuera);
    };
  }, [activa, grafica]);

  useEffect(() => {
    const chart = graficaRef.current;
    if (!chart) return undefined;
    const { sesiones } = RANGOS.find(opcion => opcion.id === rango);
    const total = grafica.velas.length + futuras.length;
    const aplicar = () => chart.timeScale().setVisibleLogicalRange({
      from: Number.isFinite(sesiones) ? Math.max(0, grafica.velas.length - sesiones) : 0,
      to: total + 1,
    });
    // El ancho final llega después del primer dibujo (autoSize); el periodo se vuelve a aplicar al cambiar de tamaño.
    const escala = chart.timeScale();
    aplicar();
    escala.subscribeSizeChange(aplicar);
    return () => escala.unsubscribeSizeChange(aplicar);
  }, [rango, grafica, futuras]);

  // Acercar o alejar desde el borde derecho, como la rueda del mouse en TradingView.
  const zoom = factor => {
    const escala = graficaRef.current?.timeScale();
    const visible = escala?.getVisibleLogicalRange();
    if (!visible) return;
    const ancho = Math.max(10, (visible.to - visible.from) * factor);
    escala.setVisibleLogicalRange({ from: visible.to - ancho, to: visible.to });
  };

  const controles = (
    <>
      <div className="ui-segments shrink-0 grid-cols-3" role="group" aria-label="Periodo visible">
        {RANGOS.map(opcion => (
          <button
            key={opcion.id}
            type="button"
            aria-pressed={rango === opcion.id}
            onClick={() => setRango(opcion.id)}
            className="ui-option min-w-9"
          >
            {opcion.id}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 gap-1" role="group" aria-label="Zoom">
        <button type="button" className="ui-button ui-icon-button text-base font-bold" aria-label="Acercar" title="Acercar" onClick={() => zoom(0.7)}>+</button>
        <button type="button" className="ui-button ui-icon-button text-base font-bold" aria-label="Alejar" title="Alejar" onClick={() => zoom(1.4)}>−</button>
      </div>
      <button
        type="button"
        aria-expanded={capasAbiertas}
        aria-controls={capasId}
        onClick={() => setCapasAbiertas(abiertas => !abiertas)}
        className={`ui-button ml-auto shrink-0 gap-2 whitespace-nowrap px-3 text-sm font-semibold ${capasAbiertas ? 'ui-button--primary' : ''}`}
      >
        <Layers className="h-4 w-4" aria-hidden="true" />
        Capas
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${capasAbiertas ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
    </>
  );

  return (
    <div className="space-y-2">
      {contenedorControles ? createPortal(controles, contenedorControles) : (
        <div className="ui-chart-toolbar" role="group" aria-label="Controles de la gráfica">{controles}</div>
      )}
      <div
        id={capasId}
        role="group"
        aria-label="Capas de la gráfica"
        hidden={!capasAbiertas}
        className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-page)] p-3.5"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-x-6 gap-y-4">
          {GRUPOS_DE_CAPAS.map(({ titulo, controles }) => (
            <fieldset key={titulo} className="min-w-0">
              <legend className="text-xs font-semibold text-[var(--ui-muted)]">{titulo}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {controles.filter(({ clave }) => {
                  if (clave === 'spot') return spot !== undefined;
                  return hayContexto || (clave !== 'collar' && clave !== 'eventos');
                }).map(({ clave, rotulo }) => {
                  const encendida = disponibles[clave] && visibles[clave];
                  const sinDatos = clave === 'collar' && !cores
                    ? 'Evalúa los cores para consultar el collar del activo.'
                    : `${rotulo} no disponible para este activo.`;
                  return (
                    <button
                      key={clave}
                      type="button"
                      aria-pressed={encendida}
                      disabled={!disponibles[clave]}
                      title={disponibles[clave] ? undefined : sinDatos}
                      onClick={() => setVisibles(actual => ({ ...actual, [clave]: !actual[clave] }))}
                      className={`ui-button px-3 text-xs font-semibold ${encendida ? 'ui-button--primary' : ''}`}
                    >
                      {rotulo}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </div>
      <p className="text-xs text-[var(--ui-muted)]">
        {activa
          ? 'Rueda o pellizca para acercar; arrastra para desplazar. Doble clic en el eje para restablecer.'
          : 'Haz clic en la gráfica para activar el zoom y el desplazamiento.'}
      </p>
      {mostrarEventos && <EventosDelActivo {...eventos} />}
      <div
        ref={marcoRef}
        className="relative"
        onMouseLeave={() => setActiva(false)}
      >
        <div
          ref={contenedorRef}
          role="img"
          aria-label={`Gráfica técnica diaria de ${serie.symbol}`}
          aria-describedby={[descripcionId, nivelesVisibles.length ? nivelesId : null].filter(Boolean).join(' ')}
          className="ui-technical-chart overflow-hidden rounded-lg"
        />
        {!activa && (
          <button
            type="button"
            onClick={() => setActiva(true)}
            className="absolute inset-0 z-10 cursor-pointer rounded-lg bg-transparent"
            aria-label="Activar zoom y desplazamiento de la gráfica"
          />
        )}
        {activa && (
          <button
            type="button"
            onClick={() => setActiva(false)}
            className="absolute top-3 left-3 z-20 rounded-md bg-[var(--ui-forest)] px-2.5 py-1.5 text-xs font-bold text-white opacity-90 shadow-md hover:opacity-100"
          >
            Bloquear gráfica
          </button>
        )}
      </div>
      {nivelesVisibles.length > 0 && (
        <p id={nivelesId} className="sr-only">
          {nivelesVisibles.map(({ etiqueta, precio }) => `${etiqueta}: ${precio.toFixed(2)} USD`).join('. ')}.
        </p>
      )}
      {visibles.collar && payoff && (
        <p className="rounded-md bg-[var(--ui-page)] px-3 py-2 text-xs text-[var(--ui-muted)]">
          <strong className="text-[var(--ui-ink)]">Ganancia máxima al vencimiento</strong>{' '}
          {dinero.format(payoff.maxProfit)} USD desde el Call de {dinero.format(collar.call.strike)} · Vencimiento {collar.expiration}
        </p>
      )}
      <ul className="flex flex-wrap gap-x-2 gap-y-1.5 px-1 text-xs text-[var(--ui-muted)]" aria-label="Leyenda de la gráfica; selecciona un elemento para resaltarlo">
        {leyendaVisible.map(({ clave, rotulo, muestra, tramos }) => (
          <li key={clave}>
            <button
              type="button"
              aria-pressed={resalte === clave}
              onClick={() => setResaltado(actual => (actual === clave ? null : clave))}
              className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-left transition-colors ${
                resalte === clave
                  ? 'border-[var(--ui-green)] bg-[var(--ui-soft)] font-bold text-[var(--ui-ink)]'
                  : 'border-transparent hover:border-[var(--ui-border)]'
              }`}
            >
              {tramos ? (
                <span className="flex gap-0.5" aria-hidden="true">
                  <Muestra estilo={{ background: COLORES.tendencia.UP }} />
                  <Muestra estilo={{ background: COLORES.tendencia.DOWN }} />
                  <Muestra estilo={{ background: COLORES.tendencia.SIDEWAYS }} />
                </span>
              ) : (
                <Muestra estilo={muestra} />
              )}
              {rotulo}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
