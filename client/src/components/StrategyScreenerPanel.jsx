import { useEffect, useMemo, useState, useRef } from 'react';
import { Eye, Layers, RefreshCw } from 'lucide-react';
import AiAnalysisPanel from './AiAnalysisPanel';
import CoreResultsModal from './CoreResultsModal';
import { LABELS } from './coresResultados';

const SELECTABLE = ['001', '002', '003', '005', '006'];
const SIN_CASILLA = [['004', 'Siempre activo'], ['007', 'Resultado']];

function BotonConsulta({ id, onAbrir }) {
  const etiqueta = `Ver resultados de ${LABELS[id]}`;
  return (
    <button
      type="button"
      className="ui-button ui-icon-button shrink-0"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={evento => onAbrir(id, evento.currentTarget)}
    >
      <Eye className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export default function StrategyScreenerPanel({
  apiBase,
  token,
  isOfflineDemo,
  limit,
  dteHorizon,
  extraSymbols = [],
  selectedSymbol,
  onSignIn,
  onScreenerResults,
  onEvaluatingChange,
  onEvaluatingError,
}) {
  const [activeCores, setActiveCores] = useState(SELECTABLE);
  const [run, setRun] = useState(0);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [rejectedSession, setRejectedSession] = useState(null);
  const [consulta, setConsulta] = useState(null);
  const disparadorRef = useRef(null);
  const session = useMemo(() => ({ apiBase, token }), [apiBase, token]);
  const needsSignIn = isOfflineDemo || !token || rejectedSession === session;

  // Mantener referencias actualizadas de los parámetros y callbacks para usarlos al pulsar "Evaluar"
  // sin provocar bucles infinitos de re-renderizado
  const paramsRef = useRef({ session, activeCores, dteHorizon, extraSymbols });
  useEffect(() => {
    paramsRef.current = { session, activeCores, dteHorizon, extraSymbols };
  }, [session, activeCores, dteHorizon, extraSymbols]);

  const callbacksRef = useRef({ onScreenerResults, onEvaluatingError, onEvaluatingChange });
  useEffect(() => {
    callbacksRef.current = { onScreenerResults, onEvaluatingError, onEvaluatingChange };
  });

  useEffect(() => {
    callbacksRef.current.onEvaluatingChange?.(loading);
  }, [loading]);

  // Ejecutar ÚNICAMENTE cuando el usuario pulsa explícitamente el botón "Evaluar Cores" (run > 0)
  // evitando bucles de re-ejecución por cambios de callbacks en el componente padre.
  useEffect(() => {
    if (needsSignIn || run === 0) return undefined;
    const { session: currentSession, activeCores: currentCores, dteHorizon: currentDte, extraSymbols: currentSymbols } = paramsRef.current;
    if (!currentCores.length) return undefined;

    const controller = new AbortController();
    setLoading(true);

    const request = async () => {
      try {
        const payload = {
          mode: 'BY_STRATEGY',
          strategy: 'COLLAR_SPREAD',
          activeCores: currentCores,
          limit: 25, // Evaluar canasta completa para que el ranking central ordene todos los activos
          dteHorizon: currentDte,
        };
        if (Array.isArray(currentSymbols) && currentSymbols.length > 0) {
          payload.extraSymbols = currentSymbols;
        }

        const res = await fetch(`${currentSession.apiBase}/api/v2/strategy-screener/run`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentSession.token}` },
          body: JSON.stringify(payload),
        });

        // Una sola consulta: si la API la rechaza se muestra su error, sin repetirla con otros parámetros.
        if (res.status === 401) {
          if (!controller.signal.aborted) {
            setRejectedSession(currentSession);
            setLoading(false);
          }
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? 'El proveedor no entregó datos suficientes.');
        if (!controller.signal.aborted) {
          setResponse({ data });
          callbacksRef.current.onEvaluatingError?.(null);
          callbacksRef.current.onScreenerResults?.(data);
          setLoading(false);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setResponse({ error: error.message });
          callbacksRef.current.onEvaluatingError?.(error.message);
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(request, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [run, needsSignIn]);

  function toggle(id) {
    setActiveCores(previous => SELECTABLE.filter(core => core === id ? !previous.includes(id) : previous.includes(core)));
  }

  const current = response;
  const data = needsSignIn ? null : current?.data;

  function abrirConsulta(id, boton) {
    disparadorRef.current = boton;
    setConsulta(id);
  }

  function cerrarConsulta() {
    setConsulta(null);
    disparadorRef.current?.focus();
  }

  return (
    <section className="ui-panel min-w-0" aria-labelledby="cores-config-title">
      <div className="flex items-center gap-2.5 border-b border-[var(--ui-border)] p-3.5">
        <Layers className="h-5 w-5 text-[var(--ui-green)]" aria-hidden="true" />
        <h2 id="cores-config-title" className="text-base font-bold tracking-tight">
          Cores &amp; Fuentes Cuantitativas
        </h2>
      </div>
      <div className="space-y-3.5 p-4 text-sm">
        <p className="text-xs text-[var(--ui-muted)] leading-relaxed">
          Filtra y calibra los motores del ranking central (Técnico, SEC EDGAR, Noticias).
        </p>

        <fieldset>
          <legend className="ui-label text-sm mb-2 font-bold">Fuentes Seleccionadas:</legend>
          <div className="grid grid-cols-1 gap-2">
            {SELECTABLE.map(id => (
              <div
                key={id}
                className={`flex items-center gap-2 rounded-lg border py-1.5 pl-3 pr-1.5 text-sm transition-colors ${
                  activeCores.includes(id)
                    ? 'border-[var(--ui-green)] bg-[var(--ui-soft)] font-bold text-[var(--ui-green)] shadow-sm'
                    : 'border-[var(--ui-border)] bg-[var(--ui-card)] text-[var(--ui-muted)]'
                }`}
              >
                {/* El botón de consulta queda fuera del label para que pulsarlo no cambie la selección. */}
                <label className={`flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 ${activeCores.includes(id) ? '' : 'opacity-75 hover:opacity-100'}`}>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[var(--ui-muted)]">{id}</span>
                    <span>{LABELS[id]}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={activeCores.includes(id)}
                    onChange={() => toggle(id)}
                    className="h-4 w-4 rounded text-[var(--ui-green)] focus:ring-[var(--ui-green)]"
                  />
                </label>
                <BotonConsulta id={id} onAbrir={abrirConsulta} />
              </div>
            ))}
            {SIN_CASILLA.map(([id, marca]) => (
              <div key={id} className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--ui-border)] py-1.5 pl-3 pr-1.5 text-sm text-[var(--ui-ink)]">
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[var(--ui-muted)]">{id}</span>
                    <span>{LABELS[id]}</span>
                  </span>
                  <span className="text-xs font-semibold text-[var(--ui-muted)]">{marca}</span>
                </span>
                <BotonConsulta id={id} onAbrir={abrirConsulta} />
              </div>
            ))}
          </div>
        </fieldset>

        {needsSignIn ? (
          <div className="space-y-2 pt-1">
            <p role="status" className="text-xs text-[var(--ui-muted)]">
              Inicia sesión en el servidor para consultar fuentes y EDGAR.
            </p>
            <button type="button" className="ui-button ui-button--primary w-full text-sm font-bold py-2" onClick={onSignIn}>
              Iniciar Sesión
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              className="ui-button ui-button--primary w-full justify-center gap-2 py-2.5 text-sm font-bold shadow-sm"
              disabled={!activeCores.length || loading}
              onClick={() => setRun(value => value + 1)}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Layers className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{current?.error ? 'Reintentar Evaluación' : loading ? 'Evaluando Cores en Vivo...' : 'Evaluar Cores Cuantitativos'}</span>
            </button>

            {!activeCores.length && <p role="status" className="text-xs text-amber-700">Selecciona al menos una fuente.</p>}
            {current?.error && <p role="alert" className="break-words text-xs text-red-700">{current.error}</p>}
            {data && !loading && (
              <p role="status" className="text-xs text-[var(--ui-muted)]">
                {data.status === 'PARTIAL' ? 'Análisis parcial' : 'Análisis completo'} · Corte {data.asOf}
              </p>
            )}
          </div>
        )}
        <AiAnalysisPanel
          key={JSON.stringify([apiBase, token, needsSignIn, activeCores, dteHorizon, extraSymbols])}
          apiBase={apiBase}
          token={token}
          needsSignIn={needsSignIn}
          symbol={selectedSymbol}
          activeCores={activeCores}
          dteHorizon={dteHorizon}
          extraSymbols={extraSymbols}
        />
      </div>
      {consulta && (
        <CoreResultsModal
          coreId={consulta}
          loading={!needsSignIn && loading}
          error={needsSignIn ? null : current?.error}
          data={data}
          apiBase={apiBase}
          token={token}
          onClose={cerrarConsulta}
        />
      )}
    </section>
  );
}
