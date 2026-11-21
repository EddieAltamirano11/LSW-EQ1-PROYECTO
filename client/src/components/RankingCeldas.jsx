import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { exclusionDeFila } from '../services/rankingCollar';

// Celdas del ranking que dependen del origen del collar (real del Core 004 o teórico del escáner) y del resultado de los cores.
const dinero = valor => (Number.isFinite(valor) ? `$${valor.toFixed(2)}` : 'Sin dato');

function Pata({ pata, tipo, color }) {
  const detalle = pata.vencimiento ? `${pata.vencimiento} · ${pata.lado} ${dinero(pata.prima)}` : `prima ${pata.lado} ${dinero(pata.prima)}`;
  return (
    <td role="cell" className="px-3 py-3.5">
      <div className={`text-sm font-bold ${color}`}>${pata.strike} {tipo}</div>
      <div className="text-xs text-[var(--ui-muted)]">{detalle}</div>
    </td>
  );
}

export function CeldasCollar({ collar }) {
  const real = collar.origen === 'REAL';
  const { tipo, monto } = collar.costoNeto;
  return (
    <>
      <Pata pata={collar.put} tipo="Put" color="text-red-800" />
      <Pata pata={collar.call} tipo="Call" color="text-[var(--ui-green)]" />
      <td role="cell" className="px-3 py-3.5">
        <div className={`text-sm font-bold ${tipo === 'Débito' ? 'text-[var(--ui-ink)]' : 'text-[var(--ui-green)]'}`}>
          {tipo === 'Costo cero' ? 'Costo cero' : `${tipo} ${dinero(monto)}/acc`}
        </div>
        {real ? (
          <span
            className="mt-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-900 border border-emerald-300"
            title={collar.cotizadoEn ? `Cotización observada más antigua de las dos patas: ${collar.cotizadoEn}` : 'Cotización observada'}
          >
            {collar.horaCotizacion ? `Real · Core 004 · ${collar.horaCotizacion}` : 'Real · Core 004'}
          </span>
        ) : (
          <span
            className="mt-1 inline-block rounded bg-[var(--ui-page)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ui-muted)] border border-[var(--ui-border)]"
            title="Valores del escáner (Black-Scholes); no son cotizaciones observadas."
          >
            Teórico · escáner
          </span>
        )}
      </td>
      <td role="cell" className="px-3 py-3.5">
        {real ? (
          <span
            className="text-xs font-semibold text-[var(--ui-muted)]"
            title="La probabilidad N(d₂) del escáner corresponde a su strike teórico, no al Put real del Core 004."
          >
            No aplica
          </span>
        ) : (
          <>
            <span className="text-sm font-bold text-[var(--ui-green)]">{collar.probabilidadPct}%</span>
            <div className="mt-1 h-2 w-16 overflow-hidden rounded-full bg-[var(--ui-border)]" aria-hidden="true">
              <div className="h-full rounded-full bg-[var(--ui-focus)]" style={{ width: `${collar.probabilidadPct}%` }} />
            </div>
          </>
        )}
      </td>
      <td role="cell" className="px-3 py-3.5 text-sm font-bold text-[var(--ui-green)]">
        {Number.isFinite(collar.retornoMaxPct) ? `+${collar.retornoMaxPct.toFixed(2)}%` : 'Sin dato'}
      </td>
    </>
  );
}

export function CeldaCores({ apta, excluida, esEtf }) {
  let contenido = <span className="text-xs text-[var(--ui-muted)]">—</span>;
  if (apta) {
    contenido = (
      <span
        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900 border border-emerald-300 shadow-sm"
        title={`Viabilidad: ${apta.eligibility || 'VIABLE'} · Análisis Multicriterio Cores`}
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
        <span>{Number.isFinite(apta.score) ? `${apta.score.toFixed(1)}/100 · Viable` : apta.eligibility || 'Apto'}</span>
      </span>
    );
  } else if (excluida) {
    const { etiqueta, causa, tipo } = exclusionDeFila(excluida);
    const estilo = tipo === 'VIABILITY_VETO'
      ? 'bg-red-50 text-red-900 border-red-300'
      : tipo === 'NO_COLLAR'
      ? 'bg-amber-50 text-amber-900 border-amber-300'
      : 'bg-[var(--ui-page)] text-[var(--ui-muted)] border-[var(--ui-border)]';
    contenido = (
      <div className="max-w-[14rem]">
        <span className={`inline-flex items-center rounded border px-2 py-1 text-xs font-semibold ${estilo}`}>{etiqueta}</span>
        <p className="mt-1 text-[11px] leading-snug text-[var(--ui-muted)] break-words">{causa}</p>
      </div>
    );
  } else if (esEtf) {
    contenido = (
      <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800 border border-blue-200">
        Benchmark ETF
      </span>
    );
  }
  return <td role="cell" className="px-3 py-3.5">{contenido}</td>;
}
