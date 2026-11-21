import React, { Fragment, Suspense, lazy, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Eye, X } from 'lucide-react';
import { CORES_INFO, datosClave, empresasEvaluadas, estadoCore, participacion } from '../services/coresInfo';
import { CoreDetail, formatNumber } from './coresResultados';
import VistaCoreTecnico from './VistaCoreTecnico';

// Las gráficas se descargan solo al abrir su pestaña.
const GraficaPayoff = lazy(() => import('./GraficaPayoff'));
const GraficaContribucion = lazy(() => import('./GraficaContribucion'));
const CON_GRAFICA = ['001', '004', '007'];

const ENFOCABLES = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function TablaDeEmpresas({ coreId, data }) {
  const [abierta, setAbierta] = useState(null);
  const empresas = empresasEvaluadas(data);
  if (!empresas.length) return <p className="text-sm text-[var(--ui-muted)]">La evaluación no devolvió empresas.</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--ui-muted)]">
        {data.status === 'PARTIAL' ? 'Análisis parcial' : 'Análisis completo'} · Corte {data.asOf} · {empresas.length} empresas evaluadas
      </p>
      <div className="overflow-x-auto rounded-lg border border-[var(--ui-border)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[var(--ui-page)] text-xs text-[var(--ui-muted)]">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Empresa</th>
              <th scope="col" className="px-3 py-2 font-semibold">Estado</th>
              <th scope="col" className="px-3 py-2 font-semibold">Puntaje</th>
              <th scope="col" className="px-3 py-2 font-semibold">Participación</th>
              <th scope="col" className="px-3 py-2 font-semibold">Datos clave</th>
              <th scope="col" className="px-3 py-2"><span className="sr-only">Evidencia</span></th>
            </tr>
          </thead>
          <tbody>
            {empresas.map(empresa => {
              const core = empresa.cores?.[coreId];
              const expandida = abierta === empresa.symbol;
              const detalleId = `detalle-${coreId}-${empresa.symbol}`;
              return (
                <Fragment key={empresa.symbol}>
                  <tr className="border-t border-[var(--ui-border)] align-top">
                    <td className="px-3 py-2">
                      <span className="font-bold">{empresa.rank ? `${empresa.rank}. ` : ''}{empresa.symbol}</span>
                      <span className="block text-xs text-[var(--ui-muted)]">
                        {empresa.companyName}{empresa.rank ? '' : ' · excluida'}
                      </span>
                    </td>
                    <td className="px-3 py-2">{estadoCore(core)}</td>
                    <td className="px-3 py-2 tabular-nums">{Number.isFinite(core?.score) ? `${formatNumber(core.score)}/100` : '—'}</td>
                    <td className="px-3 py-2">{participacion(coreId, core)}</td>
                    <td className="px-3 py-2 break-words">{datosClave(coreId, core)}</td>
                    <td className="px-3 py-2 text-right">
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
                        {core ? <CoreDetail id={coreId} diagnostic={core} /> : <p>La API no devolvió este core para la empresa.</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GraficaDelCore({ coreId, data, apiBase, token }) {
  const empresas = empresasEvaluadas(data);
  const [simbolo, setSimbolo] = useState(empresas[0]?.symbol ?? '');
  const selectorId = useId();
  const empresa = empresas.find(item => item.symbol === simbolo);
  const core = empresa?.cores?.[coreId];
  if (!empresas.length) return <p className="text-sm text-[var(--ui-muted)]">La evaluación no devolvió empresas.</p>;

  let contenido;
  if (coreId === '001') {
    contenido = <VistaCoreTecnico key={simbolo} ticker={simbolo} apiBase={apiBase} token={token} />;
  } else if (coreId === '004' && core?.result?.eligible) {
    contenido = <GraficaPayoff collar={core.result} symbol={simbolo} />;
  } else if (coreId === '007' && core?.result?.drivers?.length) {
    contenido = <GraficaContribucion confluencia={core.result} symbol={simbolo} />;
  } else {
    contenido = (
      <p className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-page)] p-4 text-sm text-[var(--ui-muted)]">
        {core?.result?.reason ?? core?.reason ?? 'El core no tiene resultado para esta empresa.'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={selectorId} className="text-sm font-semibold">Empresa</label>
        <select id={selectorId} value={simbolo} onChange={evento => setSimbolo(evento.target.value)} className="ui-field min-w-0 max-w-xs flex-1 px-3 py-1.5 text-sm">
          {empresas.map(item => (
            <option key={item.symbol} value={item.symbol}>
              {item.rank ? `${item.rank}. ` : ''}{item.symbol} · {item.companyName}{item.rank ? '' : ' (excluida)'}
            </option>
          ))}
        </select>
      </div>
      <Suspense fallback={<p role="status" className="text-sm text-[var(--ui-muted)]">Cargando la gráfica…</p>}>
        {contenido}
      </Suspense>
      <p className="text-xs text-[var(--ui-muted)]">Los mismos datos están en la pestaña Tabla.</p>
    </div>
  );
}

function ComoSeCalcula({ info, evaluado }) {
  return (
    <div className="space-y-3 text-sm">
      {!evaluado && (
        <p role="status" className="rounded-lg bg-[var(--ui-soft)] px-3 py-2 text-[var(--ui-green)]">
          Evalúa los cores para ver resultados por empresa.
        </p>
      )}
      <dl className="space-y-3">
        <div>
          <dt className="text-xs font-semibold text-[var(--ui-muted)]">Fuentes</dt>
          <dd><ul className="list-disc pl-5">{info.fuentes.map(fuente => <li key={fuente}>{fuente}</li>)}</ul></dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-[var(--ui-muted)]">Ventanas de datos</dt>
          <dd>{info.ventanas}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-[var(--ui-muted)]">Cálculo</dt>
          <dd className="leading-relaxed">{info.calculo}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-[var(--ui-muted)]">Peso</dt>
          <dd>{info.peso}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-[var(--ui-muted)]">Participación</dt>
          <dd>{info.participa}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function CoreResultsModal({ coreId, loading, error, data, apiBase = '', token, onClose }) {
  const info = CORES_INFO[coreId];
  const evaluado = Boolean(loading || error || data);
  const [pestana, setPestana] = useState(evaluado ? 'tabla' : 'calculo');
  const dialogoRef = useRef(null);
  const cerrarRef = useRef(null);
  const base = useId();
  const tituloId = `${base}-titulo`;
  const conGrafica = CON_GRAFICA.includes(coreId) && Boolean(data) && !loading && !error;
  const visible = !evaluado ? 'calculo' : pestana === 'grafica' && !conGrafica ? 'tabla' : pestana;

  useEffect(() => {
    cerrarRef.current?.focus();
  }, []);

  function alPresionarTecla(evento) {
    if (evento.key === 'Escape') {
      evento.stopPropagation();
      onClose();
      return;
    }
    if (evento.key !== 'Tab') return;
    const enfocables = [...dialogoRef.current.querySelectorAll(ENFOCABLES)];
    const primero = enfocables[0];
    const ultimo = enfocables.at(-1);
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  const pestanas = [
    ...(evaluado ? [{ id: 'tabla', etiqueta: 'Tabla' }] : []),
    ...(conGrafica ? [{ id: 'grafica', etiqueta: 'Gráfica' }] : []),
    { id: 'calculo', etiqueta: 'Cómo se calcula' },
  ];

  return (
    <div className="ui-overlay max-sm:p-0" onMouseDown={evento => evento.target === evento.currentTarget && onClose()}>
      <div
        ref={dialogoRef}
        className="ui-dialog max-w-4xl max-sm:h-[100dvh] max-sm:max-h-none max-sm:rounded-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onKeyDown={alPresionarTecla}
      >
        <header className="ui-dialog-header">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="ui-section-icon"><Eye className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <h2 id={tituloId} className="text-base font-semibold leading-tight tracking-tight sm:text-lg">
                {coreId} · {info.nombre}
              </h2>
              <p className="mt-1 text-xs text-[var(--ui-muted)]">Resultados por empresa y cómo se calcula</p>
            </div>
          </div>
          <button ref={cerrarRef} type="button" onClick={onClose} className="ui-button ui-icon-button" aria-label="Cerrar consulta del core">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="ui-dialog-body space-y-3">
          <div role="tablist" aria-label={`Consulta de ${info.nombre}`} className="ui-segments w-full max-w-sm" style={{ gridTemplateColumns: `repeat(${pestanas.length}, minmax(0, 1fr))` }}>
            {pestanas.map(({ id, etiqueta }) => (
              <button
                key={id}
                id={`${base}-pestana-${id}`}
                type="button"
                role="tab"
                aria-selected={visible === id}
                aria-controls={`${base}-panel-${id}`}
                onClick={() => setPestana(id)}
                className="ui-option py-1.5 text-sm font-semibold"
              >
                {etiqueta}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`${base}-panel-${visible}`} aria-labelledby={`${base}-pestana-${visible}`}>
            {visible === 'calculo' ? (
              <ComoSeCalcula info={info} evaluado={evaluado} />
            ) : visible === 'grafica' ? (
              <GraficaDelCore coreId={coreId} data={data} apiBase={apiBase} token={token} />
            ) : loading ? (
              <p role="status" className="text-sm text-[var(--ui-muted)]">Evaluando los cores en vivo…</p>
            ) : error ? (
              <p role="alert" className="break-words text-sm text-red-800">{error}</p>
            ) : (
              <TablaDeEmpresas coreId={coreId} data={data} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
