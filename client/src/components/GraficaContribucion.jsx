import React, { useId } from 'react';
import { contribuciones, resumenContribucion } from '../services/graficasCores';
import { useAnchoContenedor } from './useAnchoContenedor';

// Contribución de cada core al puntaje de confluencia (Core 007): barras de peso efectivo × puntaje.
const FILA = 34;
const COLOR = { barra: '#254d38', alcista: '#2f7d4f', bajista: '#b4443c', texto: '#1c2b24', tenue: '#59685e' };
const numero = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const porcentaje = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export default function GraficaContribucion({ confluencia, symbol }) {
  const resumenId = `${useId()}-resumen`;
  const [contenedorRef, ANCHO] = useAnchoContenedor();
  const ETIQUETA = Math.min(160, Math.round(ANCHO * 0.32));
  const VALOR = Math.min(170, Math.round(ANCHO * 0.36));
  const filas = contribuciones(confluencia);
  const maximo = Math.max(...filas.map(fila => fila.aporte), 1);
  const largo = ANCHO - ETIQUETA - VALOR;
  const alto = filas.length * FILA + 12;

  return (
    <figure ref={contenedorRef} className="space-y-2">
      <svg
        viewBox={`0 0 ${ANCHO} ${alto}`}
        width={ANCHO}
        height={alto}
        className="block max-w-full"
        role="img"
        aria-label={`Contribución por core de ${symbol} al puntaje de confluencia`}
        aria-describedby={resumenId}
      >
        {filas.map((fila, i) => {
          const yFila = 6 + i * FILA;
          const color = fila.conflicto ? COLOR[fila.conflicto] : COLOR.barra;
          return (
            <g key={fila.id}>
              <text x={ETIQUETA - 8} y={yFila + 19} textAnchor="end" fontSize="12" fill={COLOR.texto}>{fila.id} · {fila.nombre}</text>
              <rect
                data-testid="barra-contribucion"
                x={ETIQUETA}
                y={yFila + 6}
                width={Math.max(2, (fila.aporte / maximo) * largo)}
                height={FILA - 14}
                rx="3"
                fill={color}
                fillOpacity={fila.conflicto ? 0.85 : 0.75}
              />
              <text x={ETIQUETA + (fila.aporte / maximo) * largo + 6} y={yFila + 19} fontSize="12" fill={COLOR.tenue}>
                {numero.format(fila.aporte)} = {porcentaje.format(fila.peso * 100)} % × {numero.format(fila.puntaje)}
                {fila.conflicto ? ` · sesgo ${fila.conflicto}` : ''}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption id={resumenId} className="text-sm leading-relaxed text-[var(--ui-muted)]">
        {resumenContribucion(confluencia, filas)}
      </figcaption>
    </figure>
  );
}
