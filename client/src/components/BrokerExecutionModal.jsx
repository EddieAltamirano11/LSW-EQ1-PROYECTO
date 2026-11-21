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

  const { candidate, liveMode, broker, databaseTarget, status, ok, data, rawError, strategyType, payload } = modalData;

  const resolvedStrategy = strategyType || data?.strategyType || data?.data?.strategyType || 'COLLAR_SPREAD';
  const dbLabel = (databaseTarget || modalData.database || 'MONGODB').toString().toUpperCase();
  const brokerLabel = (broker || 'BROKER').toString().toUpperCase();
  const expLabel = candidate?.optimalExpiration || payload?.expirationDate || modalData.payload?.expirationDate || 'Vencimiento Activo';
  // La prima enviada en la orden se distingue de la teórica del escáner (Black-Scholes), que no es una cotización.
  // La prima observada de la vista previa (que el backend vuelve a cotizar al emitir) también se distingue de la teórica.
  const primaDe = pata => pata?.observedPremium ?? pata?.theoreticalPremium;
  const rotuloDe = pata => (pata?.observedPremium != null ? 'Prima observada (vista previa)' : 'Prima teórica (escáner)');
  const primaPut = payload?.putPremium ?? primaDe(candidate?.putFloor);
  const rotuloPrimaPut = payload?.putPremium != null ? 'Prima enviada' : rotuloDe(candidate?.putFloor);

  const isSuccess = ok && (status === 200 || status === 201);
  const analysis = data?.analysis || candidate;
  const execution = data?.brokerExecution || data?.data?.brokerExecution;
  const strategy = data?.strategy || data?.data;
  const orders = execution?.orders || data?.orders || data?.data?.orders || [];
  // Ejecución parcial (409): quedaron patas vivas o ejecutadas y la estrategia se guardó como PARTIALLY_EXECUTED.
  const esParcial = status === 409 || data?.strategy?.status === 'PARTIALLY_EXECUTED' || data?.data?.strategy?.status === 'PARTIALLY_EXECUTED';

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
                {resolvedStrategy === 'PROTECTIVE_PUT'
                  ? `Respuesta de Cobertura — Protective Put (${candidate?.symbol || payload?.symbol})`
                  : resolvedStrategy === 'EQUITY_ORDER'
                  ? `Respuesta de Ejecución — Orden de Acciones (${payload?.symbol || candidate?.symbol})`
                  : `Respuesta de Ejecución Bursátil — Zero-Cost Collar (${candidate?.symbol || 'COLLAR'})`}
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
                <span className="text-xs font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1 border-amber-200 bg-amber-50 text-amber-900">
                  <Zap className="w-3 h-3 text-amber-800" />
                  <span>Órdenes Reales</span>
                </span>
              </div>
              <p className="text-xs text-[var(--ui-muted)] mt-2 break-words">
                Broker: <strong className="text-[var(--ui-ink)]">{brokerLabel}</strong> • Persistencia:{' '}
                <strong className="text-[var(--ui-ink)]">{dbLabel}</strong>
                {resolvedStrategy !== 'EQUITY_ORDER' && (
                  <> • Vencimiento: <strong className="text-[var(--ui-ink)]">{expLabel}</strong></>
                )}
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

          {/* ESTRUCTURA SEGÚN ESTRATEGIA EJECUTADA */}
          {resolvedStrategy === 'PROTECTIVE_PUT' && (
            <div>
              <h3 className="text-xs font-bold text-[var(--ui-ink)] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-700" />
                <span>Desglose de la Cobertura Protective Put (Suelo Blindado)</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Pata 1: Subyacente */}
                <div className="p-3.5 bg-[var(--ui-page)] border border-[var(--ui-border)] rounded-xl space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)]">Pata 1 • Subyacente</span>
                    <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {payload?.buyUnderlying ? 'BUY (Compra)' : 'PORTAFOLIO (En Cartera)'}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-[var(--ui-ink)]">
                    {payload?.sharesCount || 100} Acciones {candidate?.symbol || payload?.symbol}
                  </div>
                  <div className="text-xs text-[var(--ui-muted)]">
                    Precio Spot: <span className="text-[var(--ui-ink)] font-mono">${candidate?.spotPrice?.toFixed(2)} USD</span>
                  </div>
                  <div className="text-xs text-[var(--ui-muted)] pt-1 border-t border-[var(--ui-border)]">
                    Rol: Activo a Proteger contra caídas
                  </div>
                </div>

                {/* Pata 2: Put Protector */}
                <div className="p-3.5 bg-[var(--ui-page)] border border-[var(--ui-border)] rounded-xl space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)]">Pata 2 • Suelo Blindado</span>
                    <span className="text-xs font-semibold text-red-800 bg-red-50 px-1.5 py-0.5 rounded">
                      BUY PUT
                    </span>
                  </div>
                  <div className="text-sm font-bold text-[var(--ui-ink)]">
                    Strike ${payload?.putStrike || candidate?.putFloor?.strike} Put
                  </div>
                  <div className="text-xs text-[var(--ui-muted)]">
                    {rotuloPrimaPut}: <span className="text-[var(--ui-ink)] font-mono">${primaPut} USD/acc</span>
                  </div>
                  <div className="text-xs text-[var(--ui-muted)] pt-1 border-t border-[var(--ui-border)]">
                    Rol: Póliza de Seguro (Piso de Venta Garantizado)
                  </div>
                </div>
              </div>
            </div>
          )}

          {resolvedStrategy === 'EQUITY_ORDER' && (
            <div>
              <h3 className="text-xs font-bold text-[var(--ui-ink)] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[var(--ui-green)]" />
                <span>Detalle de la Orden Bursátil de Acciones (Renta Variable)</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 bg-[var(--ui-page)] border border-[var(--ui-border)] rounded-xl space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)]">Operación</span>
                  <div className="text-sm font-bold text-[var(--ui-ink)]">
                    {payload?.side?.toUpperCase()} {payload?.qty} Acciones
                  </div>
                  <div className="text-xs text-[var(--ui-muted)]">
                    Ticker: <strong className="text-[var(--ui-ink)]">{payload?.symbol}</strong>
                  </div>
                  <div className="text-xs text-[var(--ui-muted)] pt-1 border-t border-[var(--ui-border)]">
                    Instrumento: Renta Variable (Spot)
                  </div>
                </div>

                <div className="p-3.5 bg-[var(--ui-page)] border border-[var(--ui-border)] rounded-xl space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)]">Tipo &amp; Precio</span>
                  <div className="text-sm font-bold text-[var(--ui-ink)]">
                    {payload?.type?.toUpperCase()}
                  </div>
                  <div className="text-xs text-[var(--ui-muted)]">
                    Precio:{' '}
                    <strong className="text-[var(--ui-ink)]">
                      {payload?.type === 'limit' && payload?.limitPrice
                        ? `$${payload.limitPrice} USD`
                        : `$${candidate?.spotPrice?.toFixed(2) || 'Mercado'} USD`}
                    </strong>
                  </div>
                  <div className="text-xs text-[var(--ui-muted)] pt-1 border-t border-[var(--ui-border)]">
                    Vigencia: DAY (Día bursátil)
                  </div>
                </div>

                <div className="p-3.5 bg-[var(--ui-page)] border border-[var(--ui-border)] rounded-xl space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)]">Capital Estimado</span>
                  <div className="text-sm font-bold text-[var(--ui-green)]">
                    ${((payload?.qty || 1) * (candidate?.spotPrice || 0)).toFixed(2)} USD
                  </div>
                  <div className="text-xs text-[var(--ui-muted)]">
                    Broker: <strong className="text-[var(--ui-ink)]">{brokerLabel}</strong>
                  </div>
                  <div className="text-xs text-[var(--ui-muted)] pt-1 border-t border-[var(--ui-border)]">
                    Persistencia: {dbLabel}
                  </div>
                </div>
              </div>
            </div>
          )}

          {resolvedStrategy === 'COLLAR_SPREAD' && (
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
                    {rotuloDe(candidate?.putFloor)}: <span className="text-[var(--ui-ink)] font-mono">${primaDe(candidate?.putFloor)}</span> ({candidate?.putFloor?.moneyness})
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
                    {rotuloDe(candidate?.callCeiling)}: <span className="text-[var(--ui-ink)] font-mono">${primaDe(candidate?.callCeiling)}</span> ({candidate?.callCeiling?.moneyness})
                  </div>
                  <div className="text-xs text-[var(--ui-muted)] pt-1 border-t border-[var(--ui-border)]">
                    Rol: Financia la Put (Costo Cero)
                  </div>
                </div>
              </div>
            </div>
          )}

          {esParcial && (
            <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-900">
              <strong>Ejecución parcial · PARTIALLY_EXECUTED.</strong> Una pata falló después de que otra quedó viva o ejecutada.
              Las patas ejecutadas no se cerraron; revisa el estado de cada orden en la tabla y en el broker.
            </div>
          )}

          {/* Órdenes procesadas por el broker, con el estado que él reporta */}
          {orders.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-amber-800" />
                <span>Órdenes procesadas por {broker}</span>
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
                            {ord.action ?? String(ord.side ?? '').toUpperCase()} {ord.quantity}x
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-[var(--ui-ink)]">${ord.limitPrice}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-xs text-[var(--ui-ink)] bg-[var(--ui-page)] border border-[var(--ui-border)] px-2 py-0.5 rounded">
                            {ord.status ?? (ord.accepted === false ? 'rechazada' : 'sin estado del broker')}
                          </span>
                          <div className="mt-0.5 text-[11px] text-[var(--ui-muted)]">
                            Ejecutado: {ord.filledQty ?? 'sin dato'}
                            {ord.verifiedInBroker === false && ord.orderId ? ' · no verificada en el libro' : ''}
                          </div>
                          {ord.cancellation?.requested && (
                            <div className="text-[11px] text-[var(--ui-muted)]">
                              Cancelación {ord.cancellation.confirmed ? 'confirmada' : 'no confirmada'}
                            </div>
                          )}
                          {ord.accepted === false && ord.brokerMessage && (
                            <div className="text-[11px] text-red-800 break-words">{ord.brokerMessage}</div>
                          )}
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

          {/* Métricas Financieras según Estrategia */}
          {resolvedStrategy === 'PROTECTIVE_PUT' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-[var(--ui-page)] rounded-xl border border-[var(--ui-border)] text-center">
              <div>
                <div className="text-xs text-[var(--ui-muted)] uppercase tracking-wider">Suelo Asegurado</div>
                <div className="text-sm font-bold text-red-800 mt-0.5">
                  ${payload?.putStrike || candidate?.putFloor?.strike} USD
                </div>
                <div className="text-xs text-[var(--ui-muted)]">Precio Mínimo de Venta</div>
              </div>

              <div>
                <div className="text-xs text-[var(--ui-muted)] uppercase tracking-wider">Costo de Seguro · {rotuloPrimaPut}</div>
                <div className="text-sm font-bold text-[var(--ui-ink)] mt-0.5">
                  ${primaPut} USD/acc
                </div>
                <div className="text-xs text-[var(--ui-muted)]">Prima Neta Pagada</div>
              </div>

              <div>
                <div className="text-xs text-[var(--ui-muted)] uppercase tracking-wider">Riesgo Máximo</div>
                <div className="text-sm font-bold text-amber-800 mt-0.5">
                  {(() => {
                    const spot = Number(candidate?.spotPrice);
                    const strike = Number(payload?.putStrike ?? candidate?.putFloor?.strike);
                    const prima = Number(primaPut);
                    return [spot, strike, prima].every(Number.isFinite) && spot > 0 ? `$${(spot - strike + prima).toFixed(2)} USD/acc` : 'sin dato';
                  })()}
                </div>
                <div className="text-xs text-[var(--ui-muted)]">Pérdida Acotada</div>
              </div>

              <div>
                <div className="text-xs text-[var(--ui-muted)] uppercase tracking-wider">Potencial Alcista</div>
                <div className="text-sm font-bold text-[var(--ui-green)] mt-0.5">
                  ILIMITADO
                </div>
                <div className="text-xs text-[var(--ui-muted)]">Sin Techo de Ganancia</div>
              </div>
            </div>
          )}

          {resolvedStrategy === 'EQUITY_ORDER' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-[var(--ui-page)] rounded-xl border border-[var(--ui-border)] text-center">
              <div>
                <div className="text-xs text-[var(--ui-muted)] uppercase tracking-wider">Ticker</div>
                <div className="text-sm font-bold text-[var(--ui-ink)] mt-0.5">
                  {payload?.symbol || candidate?.symbol}
                </div>
                <div className="text-xs text-[var(--ui-muted)]">Activo Subyacente</div>
              </div>

              <div>
                <div className="text-xs text-[var(--ui-muted)] uppercase tracking-wider">Operación</div>
                <div className="text-sm font-bold text-[var(--ui-green)] mt-0.5">
                  {payload?.side?.toUpperCase() === 'BUY' ? 'COMPRA (Long)' : 'VENTA (Liquidación)'}
                </div>
                <div className="text-xs text-[var(--ui-muted)]">{payload?.type?.toUpperCase()}</div>
              </div>

              <div>
                <div className="text-xs text-[var(--ui-muted)] uppercase tracking-wider">Cantidad</div>
                <div className="text-sm font-bold text-[var(--ui-ink)] mt-0.5">
                  {payload?.qty} acciones
                </div>
                <div className="text-xs text-[var(--ui-muted)]">Unidades operadas</div>
              </div>

              <div>
                <div className="text-xs text-[var(--ui-muted)] uppercase tracking-wider">Monto Total</div>
                <div className="text-sm font-bold text-[var(--ui-green)] mt-0.5">
                  ${((payload?.qty || 1) * (candidate?.spotPrice || 0)).toFixed(2)} USD
                </div>
                <div className="text-xs text-[var(--ui-muted)]">Estimado en Bolsa</div>
              </div>
            </div>
          )}

          {resolvedStrategy === 'COLLAR_SPREAD' && (
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
          )}

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
