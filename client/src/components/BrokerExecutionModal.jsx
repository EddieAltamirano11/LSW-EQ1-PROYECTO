import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Server,
  Database,
  Layers,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  DollarSign,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileCode,
  Zap,
} from 'lucide-react';

export default function BrokerExecutionModal({ isOpen, onClose, modalData }) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !modalData) return null;

  const { candidate, liveMode, broker, databaseTarget, status, ok, data, rawError } = modalData;

  const isSuccess = ok && (status === 200 || status === 201);
  const analysis = data?.analysis || candidate;
  const execution = data?.brokerExecution;
  const strategy = data?.strategy;
  const orders = execution?.orders || [];

  const handleCopyJson = () => {
    try {
      const fullJson = JSON.stringify(data || { error: rawError, status }, null, 2);
      navigator.clipboard.writeText(fullJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  return (
    <div className="ui-overlay">
      <div className="ui-dialog max-w-4xl" role="dialog" aria-labelledby="execution-result-title">
        <header className="ui-dialog-header">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`hidden shrink-0 rounded-lg border p-2 sm:block ${
                isSuccess
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {isSuccess ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>
            <div className="min-w-0">
              <h2 id="execution-result-title" className="break-words text-base font-semibold leading-tight tracking-tight sm:text-lg">
                Respuesta de Ejecución Bursátil ({candidate?.symbol || 'COLLAR'})
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                    isSuccess
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-red-200 bg-red-50 text-red-900'
                  }`}
                >
                  HTTP {status || (isSuccess ? 201 : 400)}
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${
                    liveMode
                      ? 'border-amber-200 bg-amber-50 text-amber-900'
                      : 'border-sky-200 bg-sky-50 text-sky-900'
                  }`}
                >
                  {liveMode ? <Zap className="w-3 h-3 text-amber-800" /> : null}
                  <span>{liveMode ? 'Órdenes Reales' : 'Simulación'}</span>
                </span>
              </div>
              <p className="text-xs text-[var(--ui-muted)] mt-2 break-words">
                Broker: <strong className="text-[var(--ui-ink)]">{broker}</strong> • Persistencia:{' '}
                <strong className="text-[var(--ui-ink)]">{databaseTarget.toUpperCase()}</strong> • Vencimiento:{' '}
                <strong className="text-[var(--ui-ink)]">{candidate?.optimalExpiration}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ui-button ui-icon-button"
            aria-label="Cerrar respuesta de ejecución"
            autoFocus
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="ui-dialog-body min-w-0 space-y-4">
          {/* Mensaje Principal del Microservicio */}
          <div
            className={`p-4 rounded-xl border text-xs leading-relaxed ${
              isSuccess
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : 'border-red-200 bg-red-50 text-red-950'
            }`}
          >
            <div className="font-semibold text-sm mb-1 flex items-center gap-2">
              <span>{isSuccess ? 'Operación Procesada con Éxito' : 'Aviso / Rechazo del Microservicio o Broker'}</span>
            </div>
            <p>{data?.message || rawError || 'Respuesta procesada correctamente.'}</p>
          </div>

          {/* Las 3 Patas Bursátiles (Estructura de la Orden) */}
          <div>
            <h3 className="text-xs font-bold text-[var(--ui-ink)] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[var(--ui-green)]" />
              <span>Desglose de las 3 Patas de Cobertura (Collar Spread)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Pata 1: Subyacente */}
              <div className="p-3.5 bg-[var(--ui-page)] border border-[var(--ui-border)] rounded-xl space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)]">Pata 1 • Subyacente</span>
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                    BUY (Largo)
                  </span>
                </div>
                <div className="text-sm font-bold text-[var(--ui-ink)]">100 Acciones {candidate?.symbol}</div>
                <div className="text-xs text-[var(--ui-muted)]">
                  Precio Spot: <span className="text-[var(--ui-ink)] font-mono">${candidate?.spotPrice?.toFixed(2)}</span>
                </div>
                <div className="text-xs text-[var(--ui-muted)] pt-1 border-t border-[var(--ui-border)]">
                  Rol: Activo a Proteger
                </div>
              </div>

              {/* Pata 2: Put Protector */}
              <div className="p-3.5 bg-[var(--ui-page)] border border-[var(--ui-border)] rounded-xl space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)]">Pata 2 • Piso Protector</span>
                  <span className="text-xs font-semibold text-red-800 bg-red-50 px-1.5 py-0.5 rounded">
                    BUY PUT
                  </span>
                </div>
                <div className="text-sm font-bold text-[var(--ui-ink)]">Strike ${candidate?.putFloor?.strike} Put</div>
                <div className="text-xs text-[var(--ui-muted)]">
                  Prima: <span className="text-[var(--ui-ink)] font-mono">${candidate?.putFloor?.marketPremium}</span> ({candidate?.putFloor?.moneyness})
                </div>
                <div className="text-xs text-[var(--ui-muted)] pt-1 border-t border-[var(--ui-border)]">
                  Rol: Póliza de Seguro (Piso de Pérdida)
                </div>
              </div>

              {/* Pata 3: Call Cubierto */}
              <div className="p-3.5 bg-[var(--ui-page)] border border-[var(--ui-border)] rounded-xl space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)]">Pata 3 • Techo Financ.</span>
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                    SELL CALL
                  </span>
                </div>
                <div className="text-sm font-bold text-[var(--ui-ink)]">Strike ${candidate?.callCeiling?.strike} Call</div>
                <div className="text-xs text-[var(--ui-muted)]">
                  Prima: <span className="text-[var(--ui-ink)] font-mono">${candidate?.callCeiling?.marketPremium}</span> ({candidate?.callCeiling?.moneyness})
                </div>
                <div className="text-xs text-[var(--ui-muted)] pt-1 border-t border-[var(--ui-border)]">
                  Rol: Financia la Put (Costo Cero)
                </div>
              </div>
            </div>
          </div>

          {/* Órdenes Confirmadas en el Broker si se ejecutó en vivo */}
          {orders.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-amber-800" />
                <span>Órdenes Confirmadas por el Matching Engine ({broker})</span>
              </h3>
              <div className="overflow-x-auto rounded-xl border border-[var(--ui-border)] bg-white" role="region" aria-label="Tabla de órdenes confirmadas" tabIndex={0}>
                <table className="w-full min-w-[36rem] text-left text-xs tabular-nums">
                  <thead className="bg-[var(--ui-soft)] text-[var(--ui-muted)] border-b border-[var(--ui-border)] text-xs uppercase">
                    <tr>
                      <th scope="col" className="py-2.5 px-3">Rol</th>
                      <th scope="col" className="py-2.5 px-3">Instrumento</th>
                      <th scope="col" className="py-2.5 px-3">Acción</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Precio Límite</th>
                      <th scope="col" className="py-2.5 px-3 text-center">Estado Broker</th>
                      <th scope="col" className="py-2.5 px-3 text-center">Order ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ui-border)] text-[var(--ui-ink)]">
                    {orders.map((ord, idx) => (
                      <tr key={idx} className="hover:bg-[var(--ui-soft)]">
                        <td className="py-2 px-3 font-semibold text-[var(--ui-ink)]">{ord.legRole}</td>
                        <td className="py-2 px-3 text-[var(--ui-ink)]">{ord.symbol || ord.contractSymbol}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                              ord.action === 'BUY' ? 'text-emerald-800 bg-emerald-50' : 'text-amber-800 bg-amber-50'
                            }`}
                          >
                            {ord.action} {ord.quantity}x
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-[var(--ui-ink)]">${ord.limitPrice}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            {ord.status || 'submitted'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center text-[var(--ui-muted)] text-xs">
                          <div className="font-mono text-[var(--ui-ink)]">{ord.orderId || 'N/A'}</div>
                          {(ord.details?.order?.strategy === 'COVERED_STOCK' || ord.details?.strategy === 'COVERED_STOCK' || (ord.legRole === 'UNDERLYING' && orders.some(o => o.legRole === 'FINANCE_CEILING' && o.orderId === ord.orderId))) && (
                            <span className="inline-block mt-0.5 text-xs text-cyan-800 bg-cyan-50 border border-cyan-200 px-1.5 py-0.5 rounded font-sans uppercase">
                              Cover Option Combo
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Métricas Financieras de la Cobertura */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-[var(--ui-page)] rounded-xl border border-[var(--ui-border)] text-center">
            <div>
              <div className="text-xs text-[var(--ui-muted)] uppercase tracking-wider">Flujo de Prima Neta</div>
              <div
                className={`text-sm font-bold mt-0.5 ${
                  candidate?.financialMetrics?.netDebitCredit >= 0 ? 'text-emerald-800' : 'text-[var(--ui-ink)]'
                }`}
              >
                {candidate?.financialMetrics?.netDebitCredit >= 0 ? '+' : ''}$
                {candidate?.financialMetrics?.netDebitCredit}/acc
              </div>
              <div className="text-xs text-[var(--ui-muted)]">Costo Cero</div>
            </div>

            <div>
              <div className="text-xs text-[var(--ui-muted)] uppercase tracking-wider">Probabilidad de Piso Seguro</div>
              <div className="text-sm font-bold text-emerald-800 mt-0.5">
                {candidate?.probabilities?.floorProtectionPct}%
              </div>
              <div className="text-xs text-[var(--ui-muted)]">Black-Scholes N(d₂)</div>
            </div>

            <div>
              <div className="text-xs text-[var(--ui-muted)] uppercase tracking-wider">Retorno Máximo</div>
              <div className="text-sm font-bold text-[var(--ui-green)] mt-0.5">
                +{candidate?.financialMetrics?.maxReturnPct}%
              </div>
              <div className="text-xs text-[var(--ui-muted)]">+${candidate?.financialMetrics?.maxProfitUSD} USD</div>
            </div>

            <div>
              <div className="text-xs text-[var(--ui-muted)] uppercase tracking-wider">Sweet Spot (Ganancia Pura)</div>
              <div className="text-sm font-bold text-sky-800 mt-0.5">
                {candidate?.probabilities?.sweetSpotPct}%
              </div>
              <div className="text-xs text-[var(--ui-muted)]">Piso &lt; S_T &lt; Techo</div>
            </div>
          </div>

          {/* Sección Colapsable: Respuesta JSON Cruda para el Profesor */}
          <div className="border border-[var(--ui-border)] rounded-xl overflow-hidden bg-[var(--ui-page)]">
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              aria-expanded={showRawJson}
              className="ui-button w-full justify-between rounded-none border-0 text-left"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileCode className="h-4 w-4 shrink-0 text-[var(--ui-green)]" aria-hidden="true" />
                <span>Ver Payload JSON Crudo de la Respuesta de la API (Auditoría HTTP)</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="hidden text-xs text-[var(--ui-muted)] sm:inline">{showRawJson ? 'Ocultar' : 'Expandir'}</span>
                {showRawJson ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
              </span>
            </button>

            {showRawJson && (
              <div className="space-y-2 border-t border-[var(--ui-border)] bg-[var(--ui-page)] p-3">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="ui-button"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-800" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar JSON'}</span>
                </button>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-white p-2 text-xs text-[var(--ui-green)]" tabIndex={0} aria-label="JSON de respuesta">
                  {JSON.stringify(data || { error: rawError, status }, null, 2)}
                </pre>
              </div>
            )}
          </div>

        </div>
        <footer className="ui-dialog-footer justify-between">
          <div className="text-xs text-[var(--ui-muted)] flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-800" />
            <span>Persistido formalmente en colección/tabla: <strong className="text-[var(--ui-ink)]">{databaseTarget}</strong></span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ui-button ui-button--primary"
          >
            Aceptar y Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
