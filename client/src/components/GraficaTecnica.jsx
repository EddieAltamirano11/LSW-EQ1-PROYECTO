import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CandlestickSeries, ColorType, CrosshairMode, LineSeries, LineStyle, createChart } from 'lightweight-charts';
import { prepararGraficaTecnica } from '../services/graficaTecnica';

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
  medias: { sma200: '#1c2b24', ema50: '#2f6fb0', ema20: '#c07a1a' },
  tendencia: { UP: '#2f7d4f', DOWN: '#b4443c', SIDEWAYS: '#9aa59d' },
};

const conAlfa = (hex, alfa) => {
  const valor = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(valor >> 16) & 255}, ${(valor >> 8) & 255}, ${valor & 255}, ${alfa})`;
};

// Opacidad de cada capa según la selección de la leyenda: normal, resaltada o atenuada.
const OPACIDAD = { banda: [0.13, 0.4, 0.05], ventana: [0.14, 0.38, 0.05], tramo: [1, 1, 0.3] };
const nivelDe = (clave, resaltado) => (!resaltado ? 0 : resaltado === clave ? 1 : 2);

const RANGOS = [
  { id: '6M', sesiones: 126 },
  { id: '1A', sesiones: 252 },
  { id: '2A', sesiones: Infinity },
];

const LEYENDA = [
  { clave: 'sma200', rotulo: 'SMA200', muestra: { background: COLORES.medias.sma200 } },
  { clave: 'ema50', rotulo: 'EMA50', muestra: { background: COLORES.medias.ema50 } },
  { clave: 'ema20', rotulo: 'EMA20', muestra: { background: COLORES.medias.ema20 } },
  { clave: 'support', rotulo: 'Soporte (S1 = mayor puntaje)', muestra: { background: conAlfa(COLORES.support, 0.13), outline: `1px dotted ${COLORES.support}` } },
  { clave: 'resistance', rotulo: 'Resistencia', muestra: { background: conAlfa(COLORES.resistance, 0.13), outline: `1px dotted ${COLORES.resistance}` } },
  { clave: 'ventana', rotulo: 'Ventana proyectada (informativa)', muestra: { background: conAlfa(COLORES.ventana, 0.14), outline: `1px dashed ${COLORES.ventana}` } },
  { clave: 'tramos', rotulo: 'Tramos UP / DOWN / SIDEWAYS (franja superior: intermedia; inferior: corta)', tramos: true },
];

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

  resaltar(clave) {
    this.resaltado = clave;
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
    for (const nivel of this.grafica.niveles) {
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
    for (const ventana of this.grafica.ventanas) {
      const x = this.horizontal(ventana.from, ventana.to);
      if (!x) continue;
      context.fillStyle = conAlfa(COLORES.ventana, OPACIDAD.ventana[nivelDe('ventana', this.resaltado)]);
      context.fillRect(x[0], 0, x[1] - x[0], mediaSize.height);
    }
  }

  dibujarFrente({ context, mediaSize }) {
    const estadoVentana = nivelDe('ventana', this.resaltado);
    context.save();
    context.font = '600 11px system-ui, sans-serif';
    context.textBaseline = 'top';
    this.grafica.ventanas.forEach((ventana, indice) => {
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
    for (const tramo of this.grafica.tramos) {
      const x = this.horizontal(tramo.start, tramo.end);
      if (!x) continue;
      context.fillStyle = conAlfa(COLORES.tendencia[tramo.direction] ?? COLORES.tendencia.SIDEWAYS, OPACIDAD.tramo[estadoTramos]);
      context.fillRect(x[0], ORIGEN_TRAMOS + tramo.fila * (ALTO_TRAMO + 2), x[1] - x[0], alto);
    }
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

export default function GraficaTecnica({ serie, descripcionId }) {
  const marcoRef = useRef(null);
  const contenedorRef = useRef(null);
  const graficaRef = useRef(null);
  const elementosRef = useRef(null);
  const [rango, setRango] = useState('1A');
  const [activa, setActiva] = useState(false);
  const [resaltado, setResaltado] = useState(null);
  const grafica = useMemo(() => prepararGraficaTecnica(serie), [serie]);

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
    const velas = chart.addSeries(CandlestickSeries, {
      upColor: COLORES.alza, downColor: COLORES.baja, wickUpColor: COLORES.alza, wickDownColor: COLORES.baja,
      borderVisible: false, priceLineVisible: false,
    });
    velas.setData([...grafica.velas, ...grafica.futuras]);
    const medias = {};
    for (const media of grafica.medias) {
      medias[media.clave] = chart.addSeries(LineSeries, {
        color: COLORES.medias[media.clave], lineWidth: media.clave === 'sma200' ? 2 : 1,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      });
      medias[media.clave].setData(media.puntos);
    }
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
    elementosRef.current = { velas, medias, lineasNivel, capas };
    return () => {
      graficaRef.current = null;
      elementosRef.current = null;
      chart.remove();
    };
  }, [grafica]);

  // Resaltado de la leyenda: el elemento elegido se intensifica y los demás se atenúan.
  useEffect(() => {
    const elementos = elementosRef.current;
    if (!elementos) return;
    const { velas, medias, lineasNivel, capas } = elementos;
    const atenuar = Boolean(resaltado);
    velas.applyOptions({
      upColor: conAlfa(COLORES.alza, atenuar ? 0.3 : 1), downColor: conAlfa(COLORES.baja, atenuar ? 0.3 : 1),
      wickUpColor: conAlfa(COLORES.alza, atenuar ? 0.3 : 1), wickDownColor: conAlfa(COLORES.baja, atenuar ? 0.3 : 1),
    });
    for (const [clave, serieMedia] of Object.entries(medias)) {
      const elegida = resaltado === clave;
      serieMedia.applyOptions({
        color: conAlfa(COLORES.medias[clave], !atenuar || elegida ? 1 : 0.2),
        lineWidth: elegida ? 4 : clave === 'sma200' ? 2 : 1,
      });
    }
    for (const { tipo, linea } of lineasNivel) {
      const elegida = resaltado === tipo;
      linea.applyOptions({
        color: conAlfa(COLORES[tipo], !atenuar || elegida ? 1 : 0.25),
        lineWidth: elegida ? 2 : 1,
        lineStyle: elegida ? LineStyle.Solid : LineStyle.Dotted,
      });
    }
    capas.resaltar(resaltado);
  }, [resaltado, grafica]);

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
    const total = grafica.velas.length + grafica.futuras.length;
    const aplicar = () => chart.timeScale().setVisibleLogicalRange({
      from: Number.isFinite(sesiones) ? Math.max(0, grafica.velas.length - sesiones) : 0,
      to: total + 1,
    });
    // El ancho final llega después del primer dibujo (autoSize); el periodo se vuelve a aplicar al cambiar de tamaño.
    const escala = chart.timeScale();
    aplicar();
    escala.subscribeSizeChange(aplicar);
    return () => escala.unsubscribeSizeChange(aplicar);
  }, [rango, grafica]);

  // Acercar o alejar desde el borde derecho, como la rueda del mouse en TradingView.
  const zoom = factor => {
    const escala = graficaRef.current?.timeScale();
    const visible = escala?.getVisibleLogicalRange();
    if (!visible) return;
    const ancho = Math.max(10, (visible.to - visible.from) * factor);
    escala.setVisibleLogicalRange({ from: visible.to - ancho, to: visible.to });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="ui-segments grid-cols-3 w-full max-w-[12rem]" role="group" aria-label="Periodo visible">
            {RANGOS.map(opcion => (
              <button
                key={opcion.id}
                type="button"
                aria-pressed={rango === opcion.id}
                onClick={() => setRango(opcion.id)}
                className="ui-option py-1 text-xs font-semibold"
              >
                {opcion.id}
              </button>
            ))}
          </div>
          <div className="flex gap-1" role="group" aria-label="Zoom">
            <button type="button" className="ui-button ui-icon-button text-base font-bold" aria-label="Acercar" title="Acercar" onClick={() => zoom(0.7)}>+</button>
            <button type="button" className="ui-button ui-icon-button text-base font-bold" aria-label="Alejar" title="Alejar" onClick={() => zoom(1.4)}>−</button>
          </div>
        </div>
        <p className="text-xs text-[var(--ui-muted)]">
          {activa
            ? 'Rueda o pellizco para acercar; arrastra para desplazar. Doble clic en el eje para restablecer.'
            : 'Haz clic en la gráfica para activar el zoom y el desplazamiento.'}
        </p>
      </div>
      <div
        ref={marcoRef}
        className="relative"
        onMouseLeave={() => setActiva(false)}
      >
        <div
          ref={contenedorRef}
          role="img"
          aria-label={`Gráfica técnica diaria de ${serie.symbol}`}
          aria-describedby={descripcionId}
          className="h-[360px] w-full overflow-hidden rounded-lg sm:h-[460px] lg:h-[600px]"
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
      <ul className="flex flex-wrap gap-x-2 gap-y-1.5 px-1 text-xs text-[var(--ui-muted)]" aria-label="Leyenda de la gráfica; selecciona un elemento para resaltarlo">
        {LEYENDA.map(({ clave, rotulo, muestra, tramos }) => (
          <li key={clave}>
            <button
              type="button"
              aria-pressed={resaltado === clave}
              onClick={() => setResaltado(actual => (actual === clave ? null : clave))}
              className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-left transition-colors ${
                resaltado === clave
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
