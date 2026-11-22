import React, { useId, useState } from 'react';
import { formatNumber } from './coresResultados';

// Vista individual del Core 002: KPI cards + trazabilidad plegada. No recalcula ningún indicador.
const TONO = {
  verde: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  ambar: 'border-amber-200 bg-amber-50 text-amber-700',
  rojo: 'border-rose-200 bg-rose-50 text-rose-700',
  azul: 'border-sky-200 bg-sky-50 text-sky-700',
  gris: 'border-slate-200 bg-slate-50 text-slate-600',
};
const TEXTO = {
  verde: 'text-emerald-700', ambar: 'text-amber-700',
  rojo: 'text-rose-700', azul: 'text-sky-700', gris: 'text-slate-500',
};
const VEREDICTOS = { VIABLE: 'verde', MARGINAL: 'ambar', NO_VIABLE: 'rojo', UNKNOWN: 'gris' };
const VALUACIONES = {
  UNDERVALUED: { texto: 'UNDERVALUED', tono: 'verde' },
  FAIR: { texto: 'FAIR', tono: 'azul' },
  OVERVALUED: { texto: 'OVERVALUED', tono: 'ambar' },
  NO_POSITIVE_EARNINGS: { texto: 'SIN EARNINGS', tono: 'gris' },
};
const RIESGOS = { LOW: 'verde', MEDIUM: 'ambar', HIGH: 'rojo', UNVERIFIED: 'gris' };

function Pill({ tono = 'gris', children }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold ${TONO[tono] ?? TONO.gris}`}>
      {children}
    </span>
  );
}

// Explicaciones generales de cada etiqueta: describen el significado, no el cálculo.
const EXPLICACIONES = {
  'Viabilidad': 'Indica si la empresa reúne condiciones financieras suficientes para seguir en el análisis.',
  'Valuación': 'Da una idea de si la acción se ve cara, razonable o barata comparado con lo que la empresa gana y vende.',
  'Riesgo de evento': 'Muestra cuánta incertidumbre hay por la proximidad de los próximos resultados.',
  'Próximos resultados': 'Fecha o ventana estimada en la que la empresa publicará sus resultados. Si no hay dato, no se inventa.',
  'Altman Z-Score': 'Indicador de salud financiera: ayuda a distinguir entre una empresa sólida, una en zona de alerta y una con riesgo financiero.',
  'Piotroski F-Score': 'Resume cuántas señales positivas mostró la empresa en sus cuentas del último año. Solo es fiable si hay información suficiente.',
  'Ratio P/E': 'Compara el precio de la acción con lo que gana la empresa por acción. Ayuda a juzgar si está cara o barata.',
  'Ejercicios fiscales': 'Los dos años de cuentas que se usaron para calcular los indicadores de la empresa.',
};

function Tarjeta({ titulo, alineacion = 'izquierda', children }) {
  const tooltipId = useId();
  const descripcion = EXPLICACIONES[titulo];

  return (
    <div className="min-w-0 rounded-lg border border-slate-200/70 bg-white p-3">
      <span className="group relative inline-block max-w-full cursor-help">
        <p
          tabIndex={0}
          aria-describedby={tooltipId}
          className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 focus:outline-none"
        >
          {titulo}
        </p>
        <span
          role="tooltip"
          id={tooltipId}
          className={`pointer-events-none absolute top-full z-20 mt-1.5 w-56 max-w-[calc(100vw-3rem)] rounded-lg border border-slate-200 bg-white p-2.5 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-slate-500 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${alineacion === 'derecha' ? 'right-0' : 'left-0'}`}
        >
          {descripcion}
        </span>
      </span>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function nombreFuente(fuente = '') {
  if (/sec/i.test(fuente)) return 'SEC EDGAR';
  if (/alpaca/i.test(fuente)) return 'Alpaca IEX';
  if (/webull/i.test(fuente)) return 'Webull';
  return fuente;
}

// Claves reales de `fScore` en fundamentalCore.js, en el orden del cálculo del F-Score.
const CRITERIOS_PIOTROSKI = [
  { clave: 'positiveRoa', nombre: 'ROA positivo', descripcion: 'Rentabilidad neta positiva sobre activos' },
  { clave: 'positiveCashFlow', nombre: 'Flujo operativo positivo', descripcion: 'Generación de efectivo operativa positiva' },
  { clave: 'improvedRoa', nombre: 'Mejora del ROA', descripcion: 'Mayor retorno sobre activos respecto al año anterior' },
  { clave: 'operatingCashAboveIncome', nombre: 'Calidad de ganancias', descripcion: 'Flujo operativo superior a la utilidad neta' },
  { clave: 'reducedLongDebt', nombre: 'Menor deuda a largo plazo', descripcion: 'Reducción del apalancamiento financiero' },
  { clave: 'improvedCurrentRatio', nombre: 'Mejor liquidez (Razón corriente)', descripcion: 'Mayor capacidad de cubrir pasivos a corto plazo' },
  { clave: 'nonDilutionProxy', nombre: 'Sin dilución de acciones', descripcion: 'No emitió nuevas acciones en el último año' },
  { clave: 'improvedGrossMargin', nombre: 'Mejor margen bruto', descripcion: 'Mayor rentabilidad bruta respecto al periodo anterior' },
  { clave: 'improvedTurnover', nombre: 'Mayor rotación de activos', descripcion: 'Más eficiencia generando ventas con sus activos' },
];

const ESTADO_PIOTROSKI = {
  aprobada: {
    barra: 'bg-emerald-500', simbolo: '✓', etiqueta: 'Aprobada',
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  reprobada: {
    barra: 'bg-slate-600', simbolo: '✕', etiqueta: 'Reprobada',
    pill: 'border-slate-300 bg-slate-100 text-slate-600',
  },
  'sin-datos': {
    barra: 'border border-dashed border-slate-300 bg-slate-100', simbolo: '—', etiqueta: 'Sin datos',
    pill: 'border-slate-200 bg-white text-slate-500',
  },
};

// Los extremos se alinean al borde de la tarjeta para que el popover no se corte en el modal.
const ALINEACION_TOOLTIP = [
  'left-0', 'left-0', 'left-0',
  'left-1/2 -translate-x-1/2', 'left-1/2 -translate-x-1/2', 'left-1/2 -translate-x-1/2',
  'right-0', 'right-0', 'right-0',
];

function BarraPiotroski({ piotroski }) {
  const aprobadas = piotroski?.passed;
  const evaluables = piotroski?.evaluated;
  const pruebas = piotroski?.tests;
  const conPruebas = pruebas && typeof pruebas === 'object';

  return (
    <div
      role="img"
      aria-label={`Pruebas Piotroski: ${Number.isFinite(aprobadas) ? aprobadas : 'N/D'} de ${Number.isFinite(evaluables) ? evaluables : 'N/D'} evaluables aprobadas`}
      className="mt-2 flex items-stretch gap-1"
    >
      {CRITERIOS_PIOTROSKI.map((criterio, indice) => {
        const valor = conPruebas
          ? pruebas[criterio.clave]
          : Number.isFinite(aprobadas) && indice < aprobadas ? true
            : Number.isFinite(evaluables) && indice < evaluables ? false : null;
        const estado = valor === true ? 'aprobada' : valor === false ? 'reprobada' : 'sin-datos';
        const detalle = ESTADO_PIOTROSKI[estado];

        return (
          <div
            key={criterio.clave}
            data-criterio={criterio.clave}
            tabIndex={0}
            aria-label={`${indice + 1}. ${criterio.nombre}: ${detalle.etiqueta}`}
            className="group relative min-w-0 flex-1 focus:outline-none"
          >
            <div className={`h-1.5 w-full origin-center cursor-help rounded-sm transition-transform duration-150 group-hover:scale-y-125 group-focus:scale-y-125 ${detalle.barra}`} />
            <div
              role="tooltip"
              className={`pointer-events-none absolute bottom-full z-20 mb-2 w-52 max-w-[calc(100vw-3rem)] rounded-lg border border-slate-200 bg-white p-2.5 text-left shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100 ${ALINEACION_TOOLTIP[indice]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-bold leading-tight text-slate-800">{indice + 1}. {criterio.nombre}</span>
                <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${detalle.pill}`}>
                  {detalle.simbolo} {detalle.etiqueta}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">{criterio.descripcion}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DetalleFundamental002({ diagnostic }) {
  const [abierta, setAbierta] = useState(false);
  const panelId = useId();
  const r = diagnostic?.result;
  const evidencia = Array.isArray(diagnostic?.evidence) ? diagnostic.evidence : [];
  const riesgo = r?.risk;
  const sinFecha = riesgo === 'UNVERIFIED';
  const fecha = r?.event?.start ?? r?.event?.end ?? null;
  const causa = r?.event?.reason
    ?? diagnostic?.reason?.replace(/^Earnings sin verificar:\s*/i, '')
    ?? null;
  const valuacion = VALUACIONES[r?.valuation] ?? { texto: 'SIN DATOS', tono: 'gris' };

  const valorZ = r?.altman?.value;
  const inferior = Number.isFinite(r?.altman?.lower) ? r.altman.lower : 1.81;
  const superior = Number.isFinite(r?.altman?.upper) ? r.altman.upper : 2.99;
  const zona = !Number.isFinite(valorZ)
    ? { texto: 'Sin datos', tono: 'gris' }
    : valorZ < inferior ? { texto: 'Zona Quiebra', tono: 'rojo' }
      : valorZ <= superior ? { texto: 'Zona Gris', tono: 'ambar' }
        : { texto: 'Zona Segura', tono: 'verde' };

  const ejercicios = Array.isArray(r?.fiscalYears) ? r.fiscalYears.slice(0, 2) : [];
  const fuentes = [...new Set(evidencia.map(item => nombreFuente(item.source)).filter(Boolean))];
  const tituloFuentes = fuentes.length
    ? `Fuentes de datos: ${fuentes.join(' · ')}`
    : 'Fuentes de datos: sin trazabilidad';

  if (!r) {
    return (
      <p className="rounded-lg border border-slate-200/70 bg-white p-3 text-sm text-slate-600">
        {diagnostic?.reason ?? 'La API no devolvió resultado para este core.'}
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tarjeta titulo="Viabilidad">
          <Pill tono={VEREDICTOS[r.classification]}>{r.classification ?? 'UNKNOWN'}</Pill>
        </Tarjeta>
        <Tarjeta titulo="Valuación" alineacion="derecha">
          <Pill tono={valuacion.tono}>{valuacion.texto}</Pill>
        </Tarjeta>
        <Tarjeta titulo="Riesgo de evento">
          <Pill tono={RIESGOS[riesgo]}>{riesgo ?? 'SIN DATOS'}</Pill>
          {sinFecha && (
            <p className="mt-1.5 text-xs leading-snug text-slate-600">
              <span>Earnings sin verificar</span>
              {causa && <> · <span>{causa}</span></>}
            </p>
          )}
        </Tarjeta>
        <Tarjeta titulo="Próximos resultados" alineacion="derecha">
          <span className={`block truncate text-lg font-bold tabular-nums ${fecha ? 'text-slate-900' : 'text-slate-400'}`}>
            {fecha ?? 'Sin fecha'}
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            {fecha ? (r.event?.estimated ? 'Ventana Webull · estimada' : 'Ventana Webull') : 'Ventana Webull sin dato utilizable'}
          </span>
        </Tarjeta>

        <Tarjeta titulo="Altman Z-Score">
          <span className="block text-2xl font-bold tabular-nums text-slate-900">
            {Number.isFinite(valorZ) ? formatNumber(valorZ) : '—'}
          </span>
          <span className={`mt-1 block text-xs font-medium ${TEXTO[zona.tono]}`}>{zona.texto}</span>
        </Tarjeta>
        <Tarjeta titulo="Piotroski F-Score" alineacion="derecha">
          <span className="block text-2xl font-bold tabular-nums text-slate-900">
            {Number.isFinite(r.piotroski?.passed) && Number.isFinite(r.piotroski?.evaluated)
              ? `${r.piotroski.passed}/${r.piotroski.evaluated}` : '—'}
          </span>
          <BarraPiotroski piotroski={r.piotroski} />
        </Tarjeta>
        <Tarjeta titulo="Ratio P/E">
          <span className="block text-2xl font-bold tabular-nums text-slate-900">
            {Number.isFinite(r.indicators?.pe) ? formatNumber(r.indicators.pe) : '—'}
          </span>
          <span className="mt-1 block text-xs text-slate-500">Múltiplo actual</span>
        </Tarjeta>
        <Tarjeta titulo="Ejercicios fiscales" alineacion="derecha">
          {ejercicios.length ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {ejercicios.map((anio, indice) => (
                <span key={`ejercicio-${indice + 1}`} className="inline-flex whitespace-nowrap rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs tabular-nums text-slate-700">
                  {String(anio)}
                </span>
              ))}
            </div>
          ) : <span className="text-xs text-slate-400">Sin datos</span>}
        </Tarjeta>
      </div>

      {(r.inference || r.scenario || (diagnostic.reason && !sinFecha)) && (
        <p className="text-xs leading-relaxed text-slate-500">
          {diagnostic.reason && !sinFecha && <>{diagnostic.reason} </>}
          {r.inference && <>{r.inference} </>}
          {r.scenario}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200/70 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <p className="text-xs font-medium text-slate-600">{tituloFuentes}</p>
          <button
            type="button"
            aria-expanded={abierta}
            aria-controls={abierta ? panelId : undefined}
            onClick={() => setAbierta(valor => !valor)}
            className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-emerald-700 hover:underline"
          >
            Ver trazabilidad <span aria-hidden="true">{abierta ? '▴' : '▾'}</span>
          </button>
        </div>
        {abierta && (
          <div id={panelId} className="border-t border-slate-200/70 px-3 py-2">
            <ul className="space-y-1 font-mono text-xs text-slate-500">
              {evidencia.map((item, indice) => (
                <li key={`${item.source}-${item.reference}-${item.observedAt}-${indice}`}>
                  {item.source}
                  {item.reference && ` · ${item.reference}`}
                  {item.observedAt && ` · ${item.observedAt}`}
                  {item.delayMinutes > 0 && ` · retraso ${item.delayMinutes} min`}
                </li>
              ))}
              {r.cik && <li>CIK · {r.cik}</li>}
              {fecha && <li>Ventana de resultados · {fecha}{r.event?.end ? ` → ${r.event.end}` : ''}</li>}
            </ul>
            {!evidencia.length && !r.cik && !fecha && (
              <p className="font-mono text-xs text-slate-500">Sin trazabilidad disponible.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
