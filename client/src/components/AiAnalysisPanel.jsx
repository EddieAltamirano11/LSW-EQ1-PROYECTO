import { useEffect, useRef, useState } from 'react';
import { ScanSearch } from 'lucide-react';

const verdicts = {
  CONSIDER: 'Sí, vale la pena evaluarla',
  AVOID: 'No, la evidencia es desfavorable',
  WAIT: 'Esperaría',
  INSUFFICIENT_DATA: 'Datos insuficientes',
};

function Fecha({ value }) {
  const label = value.length > 10 ? `${value.slice(0, 10)} ${value.slice(11, 16)} UTC` : value;
  return <time dateTime={value}>{label}</time>;
}

function Puntos({ title, points, evidence }) {
  if (!points.length) return null;
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-2 pl-4">
        {points.map(({ text, evidenceId }, index) => {
          const fact = evidence.find(item => item.id === evidenceId);
          return (
            <li key={index} className="break-words">
              <p>{text}</p>
              {fact && (
                <details className="mt-0.5 text-xs text-[var(--ui-muted)]">
                  <summary className="cursor-pointer font-semibold">{fact.label}</summary>
                  <p>{fact.detail}{fact.status === 'PARTIAL' ? ' · Diagnóstico parcial' : ''}</p>
                  <ul className="mt-1 space-y-1">
                    {fact.sources.map(({ source, observedAt, reference }, i) => (
                      <li key={i}>{source} · <Fecha value={observedAt} />{reference && ` · ${reference}`}</li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function AiAnalysisPanel({ apiBase, token, symbol, activeCores, dteHorizon, extraSymbols, needsSignIn }) {
  const latest = useRef(null);
  const [operation, setOperation] = useState(null);
  const current = operation?.symbol && operation.symbol !== symbol ? null : operation;
  const data = current?.data;
  const isSuggestion = data?.scope === 'CANDIDATES';

  useEffect(() => () => latest.current?.controller.abort(), []);
  useEffect(() => {
    const request = latest.current;
    if (request?.symbol && request.symbol !== symbol) {
      request.controller.abort();
      latest.current = null;
      setOperation(null);
    }
  }, [symbol]);

  async function analyze(scope) {
    latest.current?.controller.abort();
    const controller = new AbortController();
    const request = { controller, symbol: scope === 'SYMBOL' ? symbol : null };
    latest.current = request;
    setOperation({ symbol: request.symbol, loading: true });

    try {
      const response = await fetch(`${apiBase}/api/v2/strategy-screener/ai-analysis`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          scope, activeCores, dteHorizon,
          ...(request.symbol ? { symbol: request.symbol } : { extraSymbols }),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) throw new Error(result?.message ?? 'El Core de IA no pudo completar la consulta.');
      if (!controller.signal.aborted) setOperation({ symbol: request.symbol, data: result });
    } catch (error) {
      if (!controller.signal.aborted) setOperation({ symbol: request.symbol, error: error.message });
    }
  }

  const disabled = needsSignIn || !activeCores.length || current?.loading;

  return (
    <section className="space-y-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-card)] p-3" aria-label="Core de IA">
      <h3 className="flex items-center gap-2 font-bold">
        <ScanSearch className="h-4 w-4 text-[var(--ui-green)]" aria-hidden="true" />
        Core de IA
      </h3>
      <p className="text-xs text-[var(--ui-muted)]">Análisis informativo · Collar Spread a {dteHorizon} días</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ui-button px-2 py-1 text-xs" disabled={disabled} onClick={() => analyze('CANDIDATES')}>
          Sugerir empresas
        </button>
        <button type="button" className="ui-button px-2 py-1 text-xs" disabled={disabled || !symbol} onClick={() => analyze('SYMBOL')}>
          {symbol ? `Analizar ${symbol}` : 'Analizar empresa seleccionada'}
        </button>
      </div>
      {current?.loading && <p role="status" className="text-xs">Consultando diagnósticos y analizando evidencia…</p>}
      {current?.error && <p role="alert" className="break-words text-xs text-red-700">{current.error}</p>}
      {data && (
        <div aria-live="polite" className="space-y-2 text-xs">
          <p className="break-words text-[var(--ui-muted)]">
            Corte <Fecha value={data.asOf} />{data.model && ` · Modelo ${data.model}`}
          </p>
          {data.message && <p>{data.message}</p>}
          {isSuggestion && data.recommendations.length > 0 && <p className="font-bold">Mejores candidatas</p>}
          {data.recommendations.map(({ symbol: ticker, verdict, reasons, risks, evidence }) => (
            <article key={ticker} className="space-y-2 rounded-md border border-[var(--ui-border)] p-2.5">
              <h4 className="font-bold text-[var(--ui-green)]">{ticker}{!isSuggestion && ` · ${verdicts[verdict]}`}</h4>
              <Puntos title="Por qué" points={reasons} evidence={evidence} />
              <Puntos title="Riesgos a considerar" points={risks} evidence={evidence} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
