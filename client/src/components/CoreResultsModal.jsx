import React, { Fragment, Suspense, lazy, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, CircleHelp, Eye, X } from 'lucide-react';
import { CORES_INFO, datosClave, empresasEvaluadas, estadoCore, participacion } from '../services/coresInfo';
import { CoreDetail, formatNumber } from './coresResultados';
import ExplicacionCore002 from './ExplicacionCore002';
import TablaCore002 from './TablaCore002';
import VistaCoreTecnico from './VistaCoreTecnico';

// Las gráficas se descargan solo al abrir su pestaña.
const GraficaPayoff = lazy(() => import('./GraficaPayoff'));
const GraficaContribucion = lazy(() => import('./GraficaContribucion'));
const CON_GRAFICA = ['001', '004', '007'];

const ENFOCABLES = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const AYUDA_002 = [
  { titulo: 'Seleccionado', texto: 'El Core 002 se calcula y, además de filtrar, entra a la confluencia con su puntaje y peso base 20 (25 % efectivo con los cinco cores activos). Sus empresas VIABLES pueden seguir al ranking si cumplen el resto de filtros, con puntaje propio.' },
  { titulo: 'No seleccionado', texto: 'El Core 002 se calcula igual y sigue actuando como filtro de viabilidad (GATE): MARGINAL o NO_VIABLE quedan vetadas y no se les busca collar. Solo cambia que su puntaje no suma a la confluencia: la empresa puede entrar al ranking por los otros cores, siempre que cumpla el resto de filtros, pero sin el aporte del 20 %.' },
];

function AyudaSeleccion002() {
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (abierto) panelRef.current?.focus();
  }, [abierto]);

  function alPresionarTecla(evento) {
    if (!abierto || evento.key !== 'Escape') return;
    evento.stopPropagation();
    setAbierto(false);
    botonRef.current?.focus();
  }

  return (
    <div className="relative" onKeyDown={alPresionarTecla}>
      <button
        ref={botonRef}
        type="button"
        aria-label="Qué significa seleccionar el Core 002"
        aria-expanded={abierto}
        aria-controls={panelId}
        onClick={() => setAbierto(valor => !valor)}
        className="ui-button ui-icon-button"
      >
        <CircleHelp className="h-5 w-5" aria-hidden="true" />
      </button>
      {abierto && (
        <div
          ref={panelRef}
          id={panelId}
          role="note"
          aria-label="Qué significa seleccionar el Core 002"
          tabIndex={-1}
          className="absolute left-0 z-10 mt-2 w-[min(24rem,calc(100vw-3rem))] space-y-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-panel)] p-3 text-sm shadow-lg"
        >
          {AYUDA_002.map(({ titulo, texto }) => (
            <div key={titulo}>
              <p className="text-xs font-semibold text-[var(--ui-green)]">{titulo}</p>
              <p className="mt-1 leading-relaxed text-[var(--ui-ink)]">{texto}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
    contenido = <VistaCoreTecnico key={simbolo} ticker={simbolo} apiBase={apiBase} token={token} cores={empresa?.cores} />;
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
  const es002 = coreId === '002';

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
        className={`ui-dialog flex flex-col ${es002
          ? 'w-[95vw] max-w-6xl !max-h-[90vh] max-sm:h-[100dvh] max-sm:!max-h-none max-sm:rounded-none'
          : 'max-w-4xl max-sm:h-[100dvh] max-sm:max-h-none max-sm:rounded-none'}`}
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
        <div className="flex flex-none items-center gap-2 px-3 pb-2 pt-1 sm:px-5">
          <div role="tablist" aria-label={`Consulta de ${info.nombre}`} className={`ui-segments w-full max-w-sm ${es002 ? '!p-0.5' : ''}`} style={{ gridTemplateColumns: `repeat(${pestanas.length}, minmax(0, 1fr))` }}>
            {pestanas.map(({ id, etiqueta }) => (
              <button
                key={id}
                id={`${base}-pestana-${id}`}
                type="button"
                role="tab"
                aria-selected={visible === id}
                aria-controls={`${base}-panel-${id}`}
                onClick={() => setPestana(id)}
                className={`ui-option font-semibold ${es002 ? '!min-h-8 py-1 text-xs' : 'py-1.5 text-sm'}`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          {es002 && <AyudaSeleccion002 />}
        </div>
        <div role="tabpanel" id={`${base}-panel-${visible}`} aria-labelledby={`${base}-pestana-${visible}`} className="ui-dialog-body min-h-0 flex-1">
          {visible === 'calculo' ? (
            coreId === '002'
              ? <ExplicacionCore002 evaluado={evaluado} />
              : <ComoSeCalcula info={info} evaluado={evaluado} />
          ) : visible === 'grafica' ? (
            <GraficaDelCore coreId={coreId} data={data} apiBase={apiBase} token={token} />
          ) : loading ? (
            <p role="status" className="text-sm text-[var(--ui-muted)]">Evaluando los cores en vivo…</p>
          ) : error ? (
            <p role="alert" className="break-words text-sm text-red-800">{error}</p>
          ) : coreId === '002' ? (
            <TablaCore002 data={data} />
          ) : (
            <TablaDeEmpresas coreId={coreId} data={data} />
          )}
        </div>
      </div>
    </div>
  );
}
