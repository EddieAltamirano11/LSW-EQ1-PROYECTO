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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh] text-slate-100 flex flex-col space-y-5">
        
        {/* Encabezado del Modal */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isSuccess
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              {isSuccess ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Respuesta de Ejecución Bursátil ({candidate?.symbol || 'COLLAR'})
                </h2>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                    isSuccess
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-red-500/20 text-red-300 border-red-500/40'
                  }`}
                >
                  HTTP {status || (isSuccess ? 201 : 400)}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${
                    liveMode
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  }`}
                >
                  {liveMode ? <Zap className="w-3 h-3 text-amber-400" /> : null}
                  <span>{liveMode ? 'Órdenes Reales' : 'Simulación'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Broker: <strong className="text-slate-200">{broker}</strong> • Persistencia:{' '}
                <strong className="text-slate-200">{databaseTarget.toUpperCase()}</strong> • Vencimiento:{' '}
                <strong className="text-slate-200">{candidate?.optimalExpiration}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje Principal del Microservicio */}
        <div
          className={`p-4 rounded-xl border text-xs leading-relaxed ${
            isSuccess
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-red-500/10 border-red-500/30 text-red-200'
          }`}
        >
          <div className="font-semibold text-sm mb-1 flex items-center gap-2">
            <span>{isSuccess ? 'Operación Procesada con Éxito' : 'Aviso / Rechazo del Microservicio o Broker'}</span>
          </div>
          <p>{data?.message || rawError || 'Respuesta procesada correctamente.'}</p>
        </div>

        {/* Las 3 Patas Bursátiles (Estructura de la Orden) */}
        <div>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Desglose de las 3 Patas de Cobertura (Collar Spread)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Pata 1: Subyacente */}
            <div className="p-3.5 bg-[#0b0f19] border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pata 1 • Subyacente</span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  BUY (Largo)
                </span>
              </div>
              <div className="text-sm font-bold text-white">100 Acciones {candidate?.symbol}</div>
              <div className="text-xs text-slate-400">
                Precio Spot: <span className="text-slate-200 font-mono">${candidate?.spotPrice?.toFixed(2)}</span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
                Rol: Activo a Proteger
              </div>
            </div>

            {/* Pata 2: Put Protector */}
            <div className="p-3.5 bg-[#0b0f19] border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pata 2 • Piso Protector</span>
                <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                  BUY PUT
                </span>
              </div>
              <div className="text-sm font-bold text-white">Strike ${candidate?.putFloor?.strike} Put</div>
              <div className="text-xs text-slate-400">
                Prima: <span className="text-slate-200 font-mono">${candidate?.putFloor?.marketPremium}</span> ({candidate?.putFloor?.moneyness})
              </div>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
                Rol: Póliza de Seguro (Piso de Pérdida)
              </div>
            </div>

            {/* Pata 3: Call Cubierto */}
            <div className="p-3.5 bg-[#0b0f19] border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pata 3 • Techo Financ.</span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  SELL CALL
                </span>
              </div>
              <div className="text-sm font-bold text-white">Strike ${candidate?.callCeiling?.strike} Call</div>
              <div className="text-xs text-slate-400">
                Prima: <span className="text-slate-200 font-mono">${candidate?.callCeiling?.marketPremium}</span> ({candidate?.callCeiling?.moneyness})
              </div>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
                Rol: Financia la Put (Costo Cero)
              </div>
            </div>
          </div>
        </div>

        {/* Órdenes Confirmadas en el Broker si se ejecutó en vivo */}
        {orders.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-amber-400" />
              <span>Órdenes Confirmadas por el Matching Engine ({broker})</span>
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0b0f19]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Rol</th>
                    <th className="py-2.5 px-3">Instrumento</th>
                    <th className="py-2.5 px-3">Acción</th>
                    <th className="py-2.5 px-3 text-right">Precio Límite</th>
                    <th className="py-2.5 px-3 text-center">Estado Broker</th>
                    <th className="py-2.5 px-3 text-center">Order ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {orders.map((ord, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2 px-3 font-semibold text-slate-200">{ord.legRole}</td>
                      <td className="py-2 px-3 text-white">{ord.symbol || ord.contractSymbol}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            ord.action === 'BUY' ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
                          }`}
                        >
                          {ord.action} {ord.quantity}x
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-white">${ord.limitPrice}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                          {ord.status || 'submitted'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center text-slate-400 text-[11px]">{ord.orderId || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Métricas Financieras de la Cobertura */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 text-center">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Flujo de Prima Neta</div>
            <div
              className={`text-sm font-bold mt-0.5 ${
                candidate?.financialMetrics?.netDebitCredit >= 0 ? 'text-emerald-400' : 'text-slate-200'
              }`}
            >
              {candidate?.financialMetrics?.netDebitCredit >= 0 ? '+' : ''}$
              {candidate?.financialMetrics?.netDebitCredit}/acc
            </div>
            <div className="text-[10px] text-slate-500">Costo Cero</div>
          </div>

          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Probabilidad de Piso Seguro</div>
            <div className="text-sm font-bold text-emerald-400 mt-0.5">
              {candidate?.probabilities?.floorProtectionPct}%
            </div>
            <div className="text-[10px] text-slate-500">Black-Scholes N(d₂)</div>
          </div>

          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Retorno Máximo</div>
            <div className="text-sm font-bold text-indigo-300 mt-0.5">
              +{candidate?.financialMetrics?.maxReturnPct}%
            </div>
            <div className="text-[10px] text-slate-500">+${candidate?.financialMetrics?.maxProfitUSD} USD</div>
          </div>

          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Sweet Spot (Ganancia Pura)</div>
            <div className="text-sm font-bold text-sky-400 mt-0.5">
              {candidate?.probabilities?.sweetSpotPct}%
            </div>
            <div className="text-[10px] text-slate-500">Piso &lt; S_T &lt; Techo</div>
          </div>
        </div>

        {/* Sección Colapsable: Respuesta JSON Cruda para el Profesor */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0b0f19]">
          <button
            type="button"
            onClick={() => setShowRawJson(!showRawJson)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <span className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-indigo-400" />
              <span>Ver Payload JSON Crudo de la Respuesta de la API (Auditoría HTTP)</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500">{showRawJson ? 'Ocultar' : 'Expandir'}</span>
              {showRawJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showRawJson && (
            <div className="p-3 border-t border-slate-800 relative bg-slate-950">
              <button
                type="button"
                onClick={handleCopyJson}
                className="absolute right-5 top-5 flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar JSON'}</span>
              </button>
              <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-64 p-2 select-all">
                {JSON.stringify(data || { error: rawError, status }, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer del Modal */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Persistido formalmente en colección/tabla: <strong className="text-white">{databaseTarget}</strong></span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
          >
            Aceptar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
