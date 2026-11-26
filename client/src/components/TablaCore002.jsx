import React, { Fragment, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { formatNumber } from './coresResultados';
import DetalleFundamental002 from './DetalleFundamental002';

const ORDENES = [
  { id: 'ranking', etiqueta: 'Ranking Confluencia' },
  { id: 'fundamental', etiqueta: 'Puntaje Fundamental' },
];

const EXCLUSIONES = {
  VIABILITY_VETO: { texto: 'Veto GATE', tono: 'rojo' },
  INSUFFICIENT_DATA: { texto: 'Datos incompletos', tono: 'gris' },
  NO_COLLAR: { texto: 'Sin collar', tono: 'gris' },
};

const ESTADOS = {
  AVAILABLE: { texto: 'Disponible', tono: 'verde' },
  PARTIAL: { texto: 'Parcial', tono: 'ambar' },
  UNAVAILABLE: { texto: 'Datos insuficientes', tono: 'gris' },
  NOT_SELECTED: { texto: 'Sin seleccionar', tono: 'gris' },
};

const VEREDICTOS = {
  VIABLE: 'verde',
  MARGINAL: 'ambar',
  NO_VIABLE: 'rojo',
  UNKNOWN: 'gris',
};

const TONO = {
  verde: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  ambar: 'border-amber-200 bg-amber-50 text-amber-700',
  rojo: 'border-rose-200 bg-rose-50 text-rose-700',
  gris: 'border-slate-200 bg-slate-50 text-slate-600',
};
const PUNTO = {
  verde: 'bg-emerald-500',
  ambar: 'bg-amber-500',
  rojo: 'bg-rose-500',
  gris: 'bg-slate-400',
};

const porcentaje = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

// La zona se deriva de los umbrales informados por la API; nunca recalcula el Z.
function altmanChip(altman) {
  if (!Number.isFinite(altman?.value)) return null;
  const lower = Number.isFinite(altman.lower) ? altman.lower : 1.81;
  const upper = Number.isFinite(altman.upper) ? altman.upper : 2.99;
  const zona = altman.value < lower ? 'Zona Quiebra' : altman.value <= upper ? 'Zona Gris' : 'Zona Segura';
  return {
    texto: `Altman: ${formatNumber(altman.value)} · ${zona}`,
    titulo: `${altman.variant ?? 'Altman Z'} · umbrales ${formatNumber(lower)} / ${formatNumber(upper)}`,
  };
}

function Badge({ tono, children, titulo }) {
  return (
    <span title={titulo} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[11px] font-semibold ${TONO[tono] ?? TONO.gris}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PUNTO[tono] ?? PUNTO.gris}`} aria-hidden="true" />
      {children}
    </span>
  );
}

function Chip({ children, tenue = false, titulo }) {
  return (
    <span title={titulo} className={`inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums ${tenue
      ? 'border-slate-200 bg-white text-slate-400'
      : 'border-[var(--ui-border)] bg-[var(--ui-page)] text-[var(--ui-ink)]'}`}>
      {children}
    </span>
  );
}

function EncabezadoGrupo({ children }) {
  return (
    <tr className="border-t border-[var(--ui-border)]">
      <td colSpan={6} className="bg-[var(--ui-page)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
        {children}
      </td>
    </tr>
  );
}

export default function TablaCore002({ data }) {
  const [orden, setOrden] = useState('ranking');
  const [abierta, setAbierta] = useState(null);

  const { candidatas, excluidas } = useMemo(() => {
    const evaluadas = [...(data?.candidates ?? []), ...(data?.excluded ?? [])];
    const comparar = (a, b) => {
      if (orden === 'fundamental') {
        const sa = a.cores?.['002']?.score;
        const sb = b.cores?.['002']?.score;
        const fa = Number.isFinite(sa);
        const fb = Number.isFinite(sb);
        if (fa !== fb) return fa ? -1 : 1;
        if (fa && sa !== sb) return sb - sa;
        return a.symbol.localeCompare(b.symbol);
      }
      return (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.symbol.localeCompare(b.symbol);
    };
    return {
      candidatas: evaluadas.filter(item => item.rank).sort(comparar),
      excluidas: evaluadas.filter(item => !item.rank).sort(comparar),
    };
  }, [data, orden]);

  const total = candidatas.length + excluidas.length;
  if (!total) return <p className="text-sm text-[var(--ui-muted)]">La evaluación no devolvió empresas.</p>;

  function fila(empresa, excluida) {
    const core = empresa.cores?.['002'];
    const r = core?.result;
    const expandida = abierta === empresa.symbol;
    const detalleId = `detalle-002-${empresa.symbol}`;
    const estado = ESTADOS[core?.status] ?? { texto: 'Sin datos', tono: 'gris' };
    const exclusion = EXCLUSIONES[empresa.exclusionType] ?? { texto: 'Datos incompletos', tono: 'gris' };
    const veredicto = r?.classification ?? 'UNKNOWN';
    const altman = altmanChip(r?.altman);
    const piotroski = Number.isFinite(r?.piotroski?.passed) && Number.isFinite(r?.piotroski?.evaluated)
      ? `${r.piotroski.passed}/${r.piotroski.evaluated}` : 'N/D';
    const alerta = r?.risk === 'UNVERIFIED' ? 'Earnings N/V' : r?.risk === 'HIGH' ? 'Earnings ≤7d' : null;
    const pondera = !excluida && core?.role === 'CONFLUENCE' && Number.isFinite(core?.effectiveWeight);

    return (
      <Fragment key={empresa.symbol}>
        <tr className={`border-t border-[var(--ui-border)] align-top ${excluida ? 'opacity-85' : ''}`}>
          <td className="px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {orden === 'ranking' && empresa.rank && (
                <span
                  title="Puesto en el ranking global de confluencia"
                  aria-label={`Puesto ${empresa.rank} en el ranking global`}
                  className="inline-flex whitespace-nowrap rounded border border-[var(--ui-border)] bg-[var(--ui-page)] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--ui-muted)]"
                >
                  #{empresa.rank}
                </span>
              )}
              <span className="font-bold">{empresa.symbol}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[var(--ui-muted)]">{empresa.companyName}</span>
              {excluida && <Badge tono={exclusion.tono} titulo={empresa.reason}>{exclusion.texto}</Badge>}
            </div>
          </td>
          <td className="px-3 py-2">
            <Badge tono={estado.tono}>{estado.texto}</Badge>
          </td>
          <td className="px-3 py-2 text-right">
            {Number.isFinite(core?.score) ? (
              <>
                <span className="font-bold tabular-nums text-[var(--ui-ink)]">{formatNumber(core.score)}</span>
                <span className="ml-0.5 whitespace-nowrap text-xs text-[var(--ui-muted)]">/100</span>
              </>
            ) : <span className="text-[var(--ui-muted)]">—</span>}
          </td>
          <td className="px-3 py-2">
            {pondera
              ? <Badge tono="verde">Confluencia · {porcentaje.format(core.effectiveWeight * 100)}%</Badge>
              : <span className="text-xs text-[var(--ui-muted)]">Sin ponderación</span>}
          </td>
          <td className="px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tono={VEREDICTOS[veredicto] ?? 'gris'}>{veredicto}</Badge>
              <Chip tenue={!altman} titulo={altman?.titulo}>{altman?.texto ?? 'Altman: N/D'}</Chip>
              <Chip tenue={piotroski === 'N/D'}>Piotroski: {piotroski}</Chip>
              {alerta && (
                <Badge tono="ambar" titulo={r?.event?.start ?? 'Riesgo por resultados'}>
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  {alerta}
                </Badge>
              )}
            </div>
          </td>
          <td className="w-12 pr-2 text-right">
            <button
              type="button"
              className="ui-button ui-icon-button"
              aria-expanded={expandida}
              aria-controls={detalleId}
              aria-label={`Ver evidencia de ${empresa.symbol}`}
              title={`Ver evidencia de ${empresa.symbol}`}
              onClick={() => setAbierta(expandida ? null : empresa.symbol)}
            >
              {expandida ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
            </button>
          </td>
        </tr>
        {expandida && (
          <tr id={detalleId} className="bg-[var(--ui-page)]">
            <td colSpan={6} className="px-3 py-3">
              {core ? <DetalleFundamental002 diagnostic={core} /> : <p>La API no devolvió este core para la empresa.</p>}
            </td>
          </tr>
        )}
      </Fragment>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap">
        <p className="text-xs text-[var(--ui-muted)]">
          {data.status === 'PARTIAL' ? 'Análisis parcial' : 'Análisis completo'} · Corte {data.asOf} · {total} empresas evaluadas
        </p>
        <div role="group" aria-label="Ordenar tabla" className="ui-segments grid-cols-2">
          {ORDENES.map(({ id, etiqueta }) => (
            <button
              key={id}
              type="button"
              aria-pressed={orden === id}
              onClick={() => setOrden(id)}
              className="ui-option !min-h-7 whitespace-nowrap px-2 py-1 text-xs"
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--ui-border)]">
        <table className="w-full min-w-[880px] table-auto text-left text-sm">
          <thead className="bg-[var(--ui-page)] text-xs text-[var(--ui-muted)]">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Empresa</th>
              <th scope="col" className="px-3 py-2 font-semibold">Estado</th>
              <th scope="col" className="px-3 py-2 font-semibold">Puntaje</th>
              <th scope="col" className="px-3 py-2 font-semibold">Participación</th>
              <th scope="col" className="px-3 py-2 font-semibold">Datos clave</th>
              <th scope="col" className="w-12 pr-2 text-right"><span className="sr-only">Evidencia</span></th>
            </tr>
          </thead>
          <tbody>
            {candidatas.length > 0 && <EncabezadoGrupo>Candidatas en Ranking</EncabezadoGrupo>}
            {candidatas.map(empresa => fila(empresa, false))}
            {candidatas.length > 0 && excluidas.length > 0 && <EncabezadoGrupo>Excluidas</EncabezadoGrupo>}
            {excluidas.map(empresa => fila(empresa, true))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--ui-muted)]">
        El <span className="font-semibold">#</span> es el puesto en el ranking global de confluencia; el orden por puntaje fundamental no lo modifica.
      </p>
    </div>
  );
}
