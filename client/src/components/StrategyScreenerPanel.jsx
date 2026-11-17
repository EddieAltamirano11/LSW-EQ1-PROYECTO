import { useEffect, useMemo, useState, useRef } from 'react';
import { Layers, RefreshCw, CheckCircle2 } from 'lucide-react';

const LABELS = {
  '001': 'Técnico', '002': 'Fundamental', '003': 'Señales directas', '004': 'Estrategia de opciones',
  '005': 'Institucional', '006': 'Noticias', '007': 'Confluencia',
};
const SELECTABLE = ['001', '002', '003', '005', '006'];
const STATUS = { AVAILABLE: 'Disponible', PARTIAL: 'Parcial', UNAVAILABLE: 'Datos insuficientes', NOT_SELECTED: 'Sin seleccionar' };
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' });
const decimal = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const formatNumber = value => Number.isFinite(value) ? decimal.format(value) : 'Sin datos';
const formatMoney = value => Number.isFinite(value) ? `${currency.format(value)} USD` : 'Sin datos';

function Metrics({ entries }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
      {entries.map(([label, value]) => (
        <div className="min-w-0 break-words" key={label}>
          <dt className="text-xs text-[var(--ui-muted)]">{label}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CoreResult({ id, result }) {
  if (id === '001') {
    const day = result.timeframes.daily;
    return <Metrics entries={[
      ['Tendencia', { UP: 'Alcista', DOWN: 'Bajista', SIDEWAYS: 'Lateral' }[result.trend]], ['ADX diario', day.adx],
      ['RSI diario', day.rsi], ['Histograma MACD', day.macdHistogram], ['ATR', day.atr], ['Volumen relativo', day.relativeVolume],
      ['Soportes', result.support.map(level => formatNumber(level.price)).join(', ') || 'Sin niveles'],
      ['Resistencias', result.resistance.map(level => formatNumber(level.price)).join(', ') || 'Sin niveles'],
    ]} />;
  }
  if (id === '002') return <Metrics entries={[
    ['Viabilidad', result.classification], ['Valuación', result.valuation ?? 'Sin datos'], ['Riesgo de evento', result.risk],
    ['Próximos resultados', result.event?.start ? `${result.event.start}${result.event.estimated ? ' (estimado)' : ''}` : 'Sin datos'],
    ['Altman', formatNumber(result.altman?.value)], ['Piotroski', `${result.piotroski.passed}/${result.piotroski.evaluated}`],
    ['P/E', formatNumber(result.indicators.pe)], ['Ejercicios', result.fiscalYears.join(', ')],
  ]} />;
  if (id === '003') return <Metrics entries={[
    ['Señal', result.signal], ['Fuerza', result.strength], ['Regla', result.rule], ['Riesgo de evento', result.risk],
  ]} />;
  if (id === '004') return result.eligible ? <Metrics entries={[
    ['Put · ask', `${result.put.symbol} · ${formatMoney(result.put.ask)}`],
    ['Call · bid', `${result.call.symbol} · ${formatMoney(result.call.bid)}`], ['Vencimiento', result.expiration],
    ['Pérdida máxima', formatMoney(result.maxLoss)], ['Ganancia máxima', formatMoney(result.maxProfit)],
    ['Punto de equilibrio', formatMoney(result.breakEven)], ['Acciones', result.shares],
  ]} /> : <p>{result.reason}</p>;
  if (id === '005') return <Metrics entries={[
    ['Sesgo estimado', result.direction], ['Fuerza del flujo', result.strength],
    ['Zonas de interés', result.zones.map(zone => `${zone.strike} · ${zone.expiration}`).join(', ')],
    ['Contexto 13F', result.holdings ? `${result.holdings.filer} · ${result.holdings.period} · ${result.holdings.positions.length} registros` : 'Sin datos'],
  ]} />;
  if (id === '006') return (
    <div className="space-y-2">
      <Metrics entries={[
        ['Sentimiento', result.sentiment], ['Impacto estimado', result.impact], ['Titulares analizados', result.observed],
      ]} />
      <ul className="space-y-1 text-xs">
        {result.headlines.map(item => <li key={item.id ?? item.headline} className="break-words">
          {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="underline">{item.headline}</a> : item.headline}
          <span className="text-[var(--ui-muted)]"> · {item.type} · relevancia {item.relevance}</span>
        </li>)}
      </ul>
    </div>
  );
  return (
    <div className="space-y-2">
      <Metrics entries={[
        ['Puntaje', result.score], ['Confianza', result.confidence], ['Señal final', result.signal ?? 'Evaluación individual'],
        ['Conflictos', result.conflicts.length ? 'Sesgos opuestos' : 'Sin conflictos'],
      ]} />
      <ul className="space-y-1 text-xs">
        {result.drivers.map(driver => <li key={driver.id}>{LABELS[driver.id]} · peso {formatNumber(driver.weight * 100)} % · puntaje {driver.score}</li>)}
      </ul>
      {result.dependency && <p className="text-xs text-[var(--ui-muted)]">{result.dependency}</p>}
    </div>
  );
}

function CoreDetail({ id, diagnostic }) {
  return (
    <details className="rounded-md border border-[var(--ui-border)] px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium">
        {id} · {LABELS[id]} <span className="font-normal text-[var(--ui-muted)]">· {STATUS[diagnostic.status]}</span>
        {Number.isFinite(diagnostic.score) && <span> · {formatNumber(diagnostic.score)}/100</span>}
        {diagnostic.active === false && diagnostic.status !== 'NOT_SELECTED' && <span className="font-normal"> · Evaluado como dependencia</span>}
      </summary>
      <div className="mt-3 space-y-2">
        {diagnostic.reason && <p>{diagnostic.reason}</p>}
        {diagnostic.result && <CoreResult id={id} result={diagnostic.result} />}
        {diagnostic.result?.inference && <p className="text-xs text-[var(--ui-muted)]">{diagnostic.result.inference}</p>}
        {diagnostic.result?.scenario && <p className="text-xs text-[var(--ui-muted)]">{diagnostic.result.scenario}</p>}
        {diagnostic.evidence.length > 0 && <ul className="space-y-1 break-words text-xs text-[var(--ui-muted)]">
          {diagnostic.evidence.map((item, index) => <li key={`${item.source}-${item.reference}-${index}`}>
            {item.source}{item.reference && ` · ${item.reference}`}{item.observedAt && ` · ${item.observedAt}`}
            {item.delayMinutes > 0 && ` · retraso ${item.delayMinutes} min`}
          </li>)}
        </ul>}
      </div>
    </details>
  );
}

function Asset({ asset }) {
  return (
    <details className="border-t border-[var(--ui-border)] px-4 py-3 sm:px-5">
      <summary className="cursor-pointer break-words text-sm">
        <strong>{asset.rank ? `${asset.rank}. ` : ''}{asset.symbol}</strong> · {asset.companyName}
        {asset.rank ? ` · ${formatNumber(asset.score)}/100` : ` · ${asset.reason}`}
      </summary>
      <div className="mt-3 space-y-2">
        {Object.entries(asset.cores).map(([id, diagnostic]) => <CoreDetail key={id} id={id} diagnostic={diagnostic} />)}
      </div>
    </details>
  );
}

export default function StrategyScreenerPanel({
  apiBase,
  token,
  isOfflineDemo,
  limit,
  dteHorizon,
  extraSymbols = [],
  onSignIn,
  hideAssetList = false,
  onScreenerResults,
  onEvaluatingChange,
  onEvaluatingError,
}) {
  const [activeCores, setActiveCores] = useState(SELECTABLE);
  const [run, setRun] = useState(0);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [rejectedSession, setRejectedSession] = useState(null);
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

        let res = await fetch(`${currentSession.apiBase}/api/v2/strategy-screener/run`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentSession.token}` },
          body: JSON.stringify(payload),
        });

        // Tolerancia a fallos por incompatibilidad de versiones en backends remotos (ej. Render en rama main anterior):
        // Si el backend aún no admite limit: 25 o extraSymbols, reintentar automáticamente con parámetros legacy
        if (res.status === 400) {
          try {
            const errClone = await res.clone().json();
            const errMsg = (errClone?.message || '').toLowerCase();
            if (errMsg.includes('no admitidos') || errMsg.includes('limit')) {
              res = await fetch(`${currentSession.apiBase}/api/v2/strategy-screener/run`, {
                method: 'POST',
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentSession.token}` },
                body: JSON.stringify({
                  mode: 'BY_STRATEGY',
                  strategy: 'COLLAR_SPREAD',
                  activeCores: currentCores,
                  limit: 10,
                  dteHorizon: currentDte,
                }),
              });
            }
          } catch {
            // Continuar con res original si falla el clon
          }
        }
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

  if (hideAssetList) {
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
                <label
                  key={id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                    activeCores.includes(id)
                      ? 'border-[var(--ui-green)] bg-[var(--ui-soft)] font-bold text-[var(--ui-green)] shadow-sm'
                      : 'border-[var(--ui-border)] bg-[var(--ui-card)] text-[var(--ui-muted)] opacity-75 hover:opacity-100'
                  }`}
                >
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
            </div>
          )}
        </div>
      </section>
    );
  }
  return (
    <section className="ui-panel min-w-0" aria-labelledby="cores-ranking-title">
      <div className="space-y-3 p-4 sm:p-5">
        <h2 id="cores-ranking-title" className="text-lg font-semibold">Ranking por cores · Collar Spread</h2>
        <p className="text-sm text-[var(--ui-muted)]">Solo se clasifican empresas aptas para Collar Spread, ordenadas por el puntaje de las fuentes seleccionadas.</p>
        <fieldset>
          <legend className="ui-label">Fuentes de análisis</legend>
          <div className="flex flex-wrap gap-2">
            {SELECTABLE.map(id => <label key={id} className="ui-chip cursor-pointer">
              <input type="checkbox" checked={activeCores.includes(id)} onChange={() => toggle(id)} /> {LABELS[id]}
            </label>)}
          </div>
        </fieldset>
        {needsSignIn ? (
          <>
            <p role="status" className="text-sm text-[var(--ui-muted)]">
              {isOfflineDemo
                ? 'Para consultar datos de mercado, inicia sesión en el servidor desde el formulario de acceso.'
                : 'El servidor requiere una sesión válida. Vuelve a iniciar sesión para consultar los cores.'}
            </p>
            <button type="button" className="ui-button ui-button--primary" onClick={onSignIn}>Volver a iniciar sesión</button>
          </>
        ) : (
          <>
            <button type="button" className="ui-button ui-button--primary" disabled={!activeCores.length || loading} onClick={() => setRun(value => value + 1)}>
              {current?.error ? 'Reintentar consulta' : 'Consultar ranking por cores'}
            </button>
            {!activeCores.length && <p role="status" className="text-sm">Selecciona al menos una fuente.</p>}
            {loading && <p role="status" className="text-sm">Consultando fuentes de mercado…</p>}
            {current?.error && <p role="alert" className="break-words text-sm text-red-800">{current.error}</p>}
          </>
        )}
        {data && <p role="status" className="text-sm text-[var(--ui-muted)]">
          {data.status === 'PARTIAL' ? 'Análisis parcial' : 'Análisis completo'} · Corte {data.asOf}
        </p>}
        {data?.candidates.length === 0 && <p className="text-sm">Sin candidatos aptos con los criterios elegidos.</p>}
      </div>
      {data?.candidates.map(asset => <Asset key={asset.symbol} asset={asset} />)}
      {data?.excluded.length > 0 && <details className="border-t border-[var(--ui-border)] px-4 py-3 sm:px-5">
        <summary className="cursor-pointer text-sm font-medium">Empresas excluidas ({data.excluded.length})</summary>
        {data.excluded.map(asset => <Asset key={asset.symbol} asset={asset} />)}
      </details>}
    </section>
  );
}
