import React, { useId } from 'react';
import { payoffCollar, resumenPayoff } from '../services/graficasCores';
import { useAnchoContenedor } from './useAnchoContenedor';

// Payoff del collar al vencimiento (Core 004) en SVG propio: cuatro puntos bastan para dibujarlo.
const M = { izquierda: 56, derecha: 12, arriba: 28, abajo: 36 };
const COLOR = { ganancia: '#2f7d4f', perdida: '#b4443c', linea: '#1c2b24', guia: '#7d9182', base: '#b06d12' };
const dinero = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export default function GraficaPayoff({ collar, symbol }) {
  const id = useId();
  const [contenedorRef, ANCHO] = useAnchoContenedor();
  const ALTO = Math.round(Math.min(300, Math.max(220, ANCHO * 0.5)));
  const resumenId = `${id}-resumen`;
  const payoff = payoffCollar(collar);
  const { puntos } = payoff;
  const precioMin = puntos[0].precio;
  const precioMax = puntos[3].precio;
  const tope = Math.max(payoff.maxLoss, payoff.maxProfit) * 1.2;
  const x = precio => M.izquierda + ((precio - precioMin) / (precioMax - precioMin)) * (ANCHO - M.izquierda - M.derecha);
  const y = valor => M.arriba + ((tope - valor) / (2 * tope)) * (ALTO - M.arriba - M.abajo);
  const ceroY = y(0);
  const trazo = puntos.map(punto => `${x(punto.precio)},${y(punto.resultado)}`).join(' ');
  const area = `M${x(precioMin)},${ceroY} L${trazo.replaceAll(' ', ' L')} L${x(precioMax)},${ceroY} Z`;
  const guias = [
    { precio: collar.put.strike, rotulo: `Put ${collar.put.strike}`, color: COLOR.guia },
    { precio: payoff.breakEven, rotulo: `Equilibrio ${payoff.breakEven}`, color: COLOR.base },
    { precio: collar.call.strike, rotulo: `Call ${collar.call.strike}`, color: COLOR.guia },
  ];

  return (
    <figure ref={contenedorRef} className="space-y-2">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        width={ANCHO}
        height={ALTO}
        className="block max-w-full"
        role="img"
        aria-label={`Payoff del collar de ${symbol} al vencimiento`}
        aria-describedby={resumenId}
      >
        <defs>
          <clipPath id={`${id}-arriba`}><rect x="0" y="0" width={ANCHO} height={ceroY} /></clipPath>
          <clipPath id={`${id}-abajo`}><rect x="0" y={ceroY} width={ANCHO} height={ALTO - ceroY} /></clipPath>
        </defs>
        <path d={area} fill={COLOR.ganancia} fillOpacity="0.15" clipPath={`url(#${id}-arriba)`} />
        <path d={area} fill={COLOR.perdida} fillOpacity="0.15" clipPath={`url(#${id}-abajo)`} />
        <line x1={M.izquierda} x2={ANCHO - M.derecha} y1={ceroY} y2={ceroY} stroke={COLOR.guia} strokeWidth="1" />
        {guias.map(guia => (
          <g key={guia.rotulo}>
            <line x1={x(guia.precio)} x2={x(guia.precio)} y1={M.arriba} y2={ALTO - M.abajo} stroke={guia.color} strokeDasharray="4 3" />
            <text x={x(guia.precio)} y={ALTO - M.abajo + 16} textAnchor="middle" fontSize="12" fill={guia.color}>{guia.rotulo}</text>
          </g>
        ))}
        <polyline points={trazo} fill="none" stroke={COLOR.linea} strokeWidth="2" />
        <text x={M.izquierda - 6} y={y(payoff.maxProfit) + 4} textAnchor="end" fontSize="12" fill={COLOR.ganancia}>+{dinero.format(payoff.maxProfit)}</text>
        <text x={M.izquierda - 6} y={ceroY + 4} textAnchor="end" fontSize="12" fill={COLOR.guia}>0</text>
        <text x={M.izquierda - 6} y={y(-payoff.maxLoss) + 4} textAnchor="end" fontSize="12" fill={COLOR.perdida}>−{dinero.format(payoff.maxLoss)}</text>
        <text x={ANCHO - M.derecha} y={16} textAnchor="end" fontSize="12" fill={COLOR.guia}>USD al vencimiento según el precio de {symbol}</text>
      </svg>
      <figcaption id={resumenId} className="text-sm leading-relaxed text-[var(--ui-muted)]">
        {resumenPayoff(collar, payoff)}
      </figcaption>
    </figure>
  );
}
