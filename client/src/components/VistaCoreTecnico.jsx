import React, { Suspense, lazy, useEffect, useId, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cargarSerieTecnica, resumenTecnico } from '../services/graficaTecnica';

// La librería de gráficas queda en un chunk aparte y solo se descarga al abrir esta vista.
const GraficaTecnica = lazy(() => import('./GraficaTecnica'));

function Cargando({ texto }) {
  return (
    <div role="status" className="flex h-[360px] items-center justify-center rounded-lg bg-[var(--ui-page)] text-sm text-[var(--ui-muted)] sm:h-[460px] lg:h-[600px]">
      {texto}
    </div>
  );
}

export default function VistaCoreTecnico({ ticker, apiBase, token, onVolver }) {
  const [estado, setEstado] = useState({ fase: 'cargando' });
  const resumenId = useId();

  useEffect(() => {
    if (!ticker) {
      setEstado({ fase: 'error', causa: 'No hay un activo seleccionado.' });
      return undefined;
    }
    const controlador = new AbortController();
    setEstado({ fase: 'cargando' });
    cargarSerieTecnica({ apiBase, token, symbol: ticker, signal: controlador.signal })
      .then(serie => {
        if (!controlador.signal.aborted) setEstado({ fase: 'listo', serie });
      })
      .catch(error => {
        if (!controlador.signal.aborted) setEstado({ fase: 'error', causa: error.message });
      });
    return () => controlador.abort();
  }, [ticker, apiBase, token]);

  if (estado.fase === 'cargando') return <Cargando texto={`Cargando la serie técnica de ${ticker}…`} />;

  if (estado.fase === 'error') {
    return (
      <div className="flex min-h-[240px] flex-col items-start justify-center gap-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-page)] p-5">
        <div className="flex items-center gap-2 font-bold text-[var(--ui-ink)]">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <span>Sin datos del Core 001 para {ticker}</span>
        </div>
        <p className="text-sm text-[var(--ui-muted)] break-words">{estado.causa}</p>
        {onVolver && (
          <button type="button" onClick={onVolver} className="ui-button text-sm font-semibold">
            Volver a TradingView
          </button>
        )}
      </div>
    );
  }

  const { serie } = estado;
  return (
    <div className="space-y-3">
      <Suspense fallback={<Cargando texto="Cargando la gráfica…" />}>
        <GraficaTecnica serie={serie} descripcionId={resumenId} />
      </Suspense>
      <div id={resumenId} className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-page)] p-3 sm:p-4">
        <p className="mb-1.5 text-sm font-bold text-[var(--ui-green)]">Resumen del Core 001</p>
        <ul className="space-y-1 text-sm leading-relaxed text-[var(--ui-muted)]">
          {resumenTecnico(serie).map(linea => <li key={linea} className="break-words">{linea}</li>)}
        </ul>
        <p className="mt-2 text-xs text-[var(--ui-muted)]">
          Corte: {serie.lastSession} · {serie.limitation}
        </p>
      </div>
    </div>
  );
}
