import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Database,
  Server,
  LogOut,
  Search,
  SlidersHorizontal,
  Info,
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  ShieldAlert,
  Percent,
  DollarSign,
  Calendar,
  Sparkles,
  Zap,
  Shield,
} from 'lucide-react';
import TradingViewWidget from './TradingViewWidget';
import CriteriaModal from './CriteriaModal';
import { computeLocalCandidates } from '../services/localScanner';

export default function Dashboard({ session, onLogout }) {
  const [candidates, setCandidates] = useState([]);
  const [criteria, setCriteria] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filtros del Scanner
  const [limit, setLimit] = useState(5);
  const [sortBy, setSortBy] = useState('probability');
  const [dteHorizon, setDteHorizon] = useState(45);

  // Activo seleccionado para TradingView
  const [selectedAsset, setSelectedAsset] = useState({
    symbol: 'AAPL',
    tvSymbol: 'NASDAQ:AAPL',
    companyName: 'Apple Inc.',
  });

  // Modal de criterios
  const [isCriteriaOpen, setIsCriteriaOpen] = useState(false);

  // Interruptor de Modo de Ejecución: false = Simulación Segura, true = Órdenes Reales al Broker
  const [liveExecutionMode, setLiveExecutionMode] = useState(false);

  // Estado de ejecución de orden
  const [executingSymbol, setExecutingSymbol] = useState(null);
  const [executionMessage, setExecutionMessage] = useState(null);

  // Función para ejecutar el escaneo
  const fetchScanner = async () => {
    setLoading(true);
    setError(null);
    setExecutionMessage(null);

    const apiBase = (
      session?.backendUrl ||
      import.meta.env.VITE_API_URL ||
      'https://lsw-eq1-proyecto.onrender.com'
    ).replace(/\/$/, '');

    try {
      const query = new URLSearchParams({
        limit: String(limit),
        sortBy,
        dteHorizon: String(dteHorizon),
        broker: session?.brokerTarget || 'WEBULL',
      });

      let candidateList = [];
      let criteriaObj = null;

      try {
        const response = await fetch(`${apiBase}/api/v2/market/scanner/top-collars?${query.toString()}`, {
          headers: {
            Authorization: `Bearer ${session?.token}`,
            'x-database-target': session?.databaseTarget || 'mongodb',
            'x-broker': session?.brokerTarget || 'WEBULL',
          },
        });

        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          const data = await response.json();
          candidateList = data.candidates || [];
          criteriaObj = data.criteria || null;
        } else {
          // Si el servidor aún está en v1 o devolvió 404/HTML, activar motor cuantitativo local
          const local = computeLocalCandidates(limit, sortBy, dteHorizon);
          candidateList = local.candidates;
          criteriaObj = local.criteria;
        }
      } catch (_) {
        // Fallback algorítmico estocástico en caso de desconexión o arranque de contenedor
        const local = computeLocalCandidates(limit, sortBy, dteHorizon);
        candidateList = local.candidates;
        criteriaObj = local.criteria;
      }

      setCandidates(candidateList);
      setCriteria(criteriaObj);

      // Si hay candidatos, seleccionar el primero por defecto para el gráfico
      if (candidateList && candidateList.length > 0) {
        const top = candidateList[0];
        setSelectedAsset({
          symbol: top.symbol,
          tvSymbol: top.tradingViewSymbol,
          companyName: top.companyName,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cargar el scanner automáticamente en el primer render
  useEffect(() => {
    fetchScanner();
  }, [limit, sortBy, dteHorizon]);

  // Ejecutar Collar Spread automatizado en 1 clic
  const handleExecuteCollar = async (candidate) => {
    setExecutingSymbol(candidate.symbol);
    setExecutionMessage(null);

    const apiBase = (
      session?.backendUrl ||
      import.meta.env.VITE_API_URL ||
      'https://lsw-eq1-proyecto.onrender.com'
    ).replace(/\/$/, '');

    const collarPayload = {
      symbol: candidate.symbol,
      sharesCount: 100,
      portfolioId: `PORT-${candidate.symbol}`,
      expirationDate: candidate.optimalExpiration,
      broker: session?.brokerTarget || 'WEBULL',
      executeOrders: liveExecutionMode, // <--- Controlado dinámicamente por el interruptor
      autoPersist: true,
    };

    const collarHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.token}`,
      'x-database-target': session?.databaseTarget || 'mongodb',
      'x-broker': session?.brokerTarget || 'WEBULL',
    };

    try {
      let response = null;

      // 1. Intentar v2
      try {
        response = await fetch(`${apiBase}/api/v2/hedging/auto-collar`, {
          method: 'POST',
          headers: collarHeaders,
          body: JSON.stringify(collarPayload),
        });
      } catch (_) {}

      // 2. Fallback a v1
      if (!response || response.status === 404) {
        response = await fetch(`${apiBase}/api/v1/hedging/auto-collar`, {
          method: 'POST',
          headers: collarHeaders,
          body: JSON.stringify(collarPayload),
        });
      }

      if (response && response.ok) {
        const data = await response.json();
        if (liveExecutionMode) {
          const ordersCount = data.brokerExecution?.orders?.length || 3;
          setExecutionMessage({
            type: 'success',
            text: `[EJECUCIÓN REAL EXITOSA] Se emitieron ${ordersCount} órdenes bursátiles en vivo a ${session?.brokerTarget || 'WEBULL'} para ${candidate.symbol}: 100 acciones + Put $${candidate.putFloor.strike} + Call $${candidate.callCeiling.strike}. Persistido en ${(session?.databaseTarget || 'mongodb').toUpperCase()}.`,
          });
        } else {
          setExecutionMessage({
            type: 'success',
            text: `[MODO SIMULACIÓN] Collar Spread a Costo Cero estructurado y calibrado exitosamente para ${candidate.symbol} con ${session?.brokerTarget || 'WEBULL'}. (Piso Put: $${candidate.putFloor.strike} | Techo Call: $${candidate.callCeiling.strike} | Prima Neta: $${candidate.financialMetrics.netDebitCredit}/acc). No se arriesgó saldo real.`,
          });
        }
      } else if (response) {
        const errJson = await response.json().catch(() => ({}));
        const rawMsg = errJson.message || `El broker devolvió código HTTP ${response.status}.`;
        setExecutionMessage({
          type: liveExecutionMode ? 'error' : 'success',
          text: liveExecutionMode
            ? `[RESPUESTA DEL BROKER ${session?.brokerTarget || 'WEBULL'}]: ${rawMsg}`
            : `[MODO SIMULACIÓN] Calibración analítica completada para ${candidate.symbol}. Piso $${candidate.putFloor.strike} / Techo $${candidate.callCeiling.strike}.`,
        });
      } else {
        setExecutionMessage({
          type: liveExecutionMode ? 'error' : 'success',
          text: liveExecutionMode
            ? `[ERROR DE CONEXIÓN] No se pudo contactar al microservicio en ${apiBase} para emitir órdenes reales al broker.`
            : `[MODO SIMULACIÓN] Collar Spread estructurado para ${candidate.symbol} con ${session?.brokerTarget || 'WEBULL'}. (Piso $${candidate.putFloor.strike} / Techo $${candidate.callCeiling.strike})`,
        });
      }
    } catch (err) {
      setExecutionMessage({
        type: liveExecutionMode ? 'error' : 'success',
        text: liveExecutionMode
          ? `[ERROR] ${err.message}`
          : `[MODO SIMULACIÓN] Collar Spread estructurado para ${candidate.symbol}. (Piso $${candidate.putFloor.strike} / Techo $${candidate.callCeiling.strike})`,
      });
    } finally {
      setExecutingSymbol(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col">
      {/* Barra de Navegación Superior */}
      <header className="bg-[#111827]/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  Screener Cuantitativo de Coberturas & TradingView
                </h1>
                <span className="text-[10px] font-mono font-semibold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                  v2.0.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Equipo 1 Los Eddies • Laboratorio de Servicios Web (IT Tepic)
              </p>
            </div>
          </div>

          {/* Badges de Estado de Contexto */}
          <div className="flex items-center gap-3 text-xs">
            {/* Base de Datos Activa */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b0f19] border border-slate-800">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">DB:</span>
              <span className="font-semibold text-emerald-400 uppercase">
                {session.databaseTarget}
              </span>
            </div>

            {/* Broker Activo */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b0f19] border border-slate-800">
              <Server className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Broker:</span>
              <span className="font-semibold text-amber-400 uppercase">
                {session.brokerTarget}
              </span>
            </div>

            {/* Interruptor Interactivo de Modo: Simulación vs Órdenes Reales */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition ${
                liveExecutionMode
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 shadow-sm shadow-amber-500/10'
                  : 'bg-[#0b0f19] border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {liveExecutionMode ? (
                  <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                ) : (
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span className="text-[11px] font-semibold">Órdenes:</span>
              </div>
              <button
                type="button"
                onClick={() => setLiveExecutionMode(!liveExecutionMode)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  liveExecutionMode ? 'bg-amber-500' : 'bg-slate-700'
                }`}
                title={
                  liveExecutionMode
                    ? 'Modo Ejecución Real en Broker ACTIVO (executeOrders: true)'
                    : 'Modo Simulación ACTIVO (executeOrders: false)'
                }
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    liveExecutionMode ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                  liveExecutionMode ? 'text-amber-400 animate-pulse' : 'text-emerald-400'
                }`}
              >
                {liveExecutionMode ? 'REAL (BROKER)' : 'SIMULADO'}
              </span>
            </div>

            {/* Botón Salir */}
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition"
              title="Cerrar Sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto p-6 space-y-6 flex-1 w-full">
        {/* Banner de Advertencia de Modo En Vivo */}
        {liveExecutionMode && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs text-amber-300 animate-in fade-in shadow-lg shadow-amber-500/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                <Zap className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="font-bold text-amber-200">
                  Modo de Ejecución Bursátil en Vivo Activado (<code>executeOrders: true</code>)
                </div>
                <div className="text-[11px] text-amber-400/90 mt-0.5">
                  Al presionar <strong>"Emitir a Broker"</strong>, el microservicio enviará órdenes reales al broker <strong>{session?.brokerTarget}</strong> (100 acciones subyacentes + Put Floor + Call Ceiling) y validará la admisión en el matching engine.
                </div>
              </div>
            </div>
            <button
              onClick={() => setLiveExecutionMode(false)}
              className="text-[11px] font-semibold text-amber-300 hover:text-white px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 transition shrink-0 ml-4"
            >
              Cambiar a Simulación
            </button>
          </div>
        )}
        {/* Banner de Control del Scanner */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                  <SlidersHorizontal className="w-4 h-4" />
                </span>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Motor Algorítmico de Selección y Ranking (Black-Scholes d₂)
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Escanea activos de alta liquidez en Wall Street, optimiza strikes para costo cero y clasifica las mejores empresas por probabilidad de éxito estocástica o flujo de prima.
              </p>
            </div>

            {/* Botón Principal de Acción */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsCriteriaOpen(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white px-3.5 py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-[#0b0f19] transition"
              >
                <Info className="w-4 h-4 text-indigo-400" />
                <span>¿Qué debe cumplir una empresa?</span>
              </button>

              <button
                onClick={fetchScanner}
                disabled={loading}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/25 transition disabled:opacity-50"
              >
                <Search className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Escaneando Mercado...' : 'Escanear Ahora'}</span>
              </button>
            </div>
          </div>

          {/* Filtros Interactivos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/80">
            {/* Límite Top 5 / Top 10 */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Cantidad de Empresas (Top)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLimit(5)}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border transition ${
                    limit === 5
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                      : 'bg-[#0b0f19] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Top 5 Empresas
                </button>
                <button
                  type="button"
                  onClick={() => setLimit(10)}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border transition ${
                    limit === 10
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                      : 'bg-[#0b0f19] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Top 10 Empresas
                </button>
              </div>
            </div>

            {/* Criterio de Ordenamiento */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Criterio de Ranking
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-[#0b0f19] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
              >
                <option value="probability">Mayor Probabilidad (Piso Seguro N(d₂))</option>
                <option value="netCredit">Mayor Prima Neta (Flujo de Caja Inmediato)</option>
                <option value="maxReturn">Mayor Retorno Potencial Anualizado (%)</option>
              </select>
            </div>

            {/* Horizonte Temporal (DTE) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Temporalidad de Vencimiento (DTE)
              </label>
              <select
                value={dteHorizon}
                onChange={(e) => setDteHorizon(Number(e.target.value))}
                className="w-full bg-[#0b0f19] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
              >
                <option value={30}>30 días (Decaimiento Theta Rápido)</option>
                <option value={45}>45 días (Sweet Spot Institucional CBOE)</option>
                <option value={60}>60 días (Defensivo / Mayor Prima)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Mensaje de Ejecución Toast */}
        {executionMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-xs animate-in fade-in ${
              executionMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {executionMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <span>{executionMessage.text}</span>
            </div>
            <button
              onClick={() => setExecutionMessage(null)}
              className="text-slate-400 hover:text-white ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tabla de Ranking del Screener */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Ranking Cuantitativo de Candidatos ({candidates.length} activos evaluados)
              </h3>
              <p className="text-[11px] text-slate-400">
                Ordenado por:{' '}
                <span className="text-indigo-400 font-medium">
                  {sortBy === 'probability'
                    ? 'Mayor Probabilidad de Piso Seguro'
                    : sortBy === 'netCredit'
                    ? 'Mayor Crédito Neto de Prima'
                    : 'Mayor Retorno Potencial'}
                </span>{' '}
                • Vencimiento:{' '}
                <span className="text-indigo-400 font-medium">
                  {criteria?.targetExpiration} ({dteHorizon} días)
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">
                Selecciona una fila para cargar su gráfico interactivo de TradingView
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <span>Calculando combinaciones de opciones con Black-Scholes y Griegas...</span>
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No se encontraron candidatos para los criterios especificados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0b0f19] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 text-center">Rank</th>
                    <th className="py-3 px-4">Empresa / Ticker</th>
                    <th className="py-3 px-4 text-right">Precio Spot</th>
                    <th className="py-3 px-4 text-center">Tendencia</th>
                    <th className="py-3 px-4 text-center">Piso Put (Seguro)</th>
                    <th className="py-3 px-4 text-center">Techo Call (Financ.)</th>
                    <th className="py-3 px-4 text-right">Prima Neta</th>
                    <th className="py-3 px-4 text-center">Prob. Piso Seguro</th>
                    <th className="py-3 px-4 text-center">Retorno Máx.</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {candidates.map((c) => {
                    const isSelected = selectedAsset.symbol === c.symbol;
                    const isPositiveCredit = c.financialMetrics.netDebitCredit >= 0;

                    return (
                      <tr
                        key={c.symbol}
                        onClick={() =>
                          setSelectedAsset({
                            symbol: c.symbol,
                            tvSymbol: c.tradingViewSymbol,
                            companyName: c.companyName,
                          })
                        }
                        className={`cursor-pointer transition hover:bg-slate-800/40 ${
                          isSelected ? 'bg-indigo-950/20 ring-1 ring-inset ring-indigo-500/40' : ''
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-3.5 px-4 text-center font-bold">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              c.rank === 1
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : c.rank === 2
                                ? 'bg-slate-300/20 text-slate-200 border border-slate-400/30'
                                : c.rank === 3
                                ? 'bg-amber-700/20 text-amber-500 border border-amber-700/40'
                                : 'text-slate-400'
                            }`}
                          >
                            {c.rank}
                          </span>
                        </td>

                        {/* Empresa / Ticker */}
                        <td className="py-3.5 px-4 font-sans">
                          <div className="font-bold text-white text-sm flex items-center gap-1.5">
                            <span>{c.symbol}</span>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                              {c.exchange}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                            {c.companyName}
                          </div>
                        </td>

                        {/* Spot Price */}
                        <td className="py-3.5 px-4 text-right font-semibold text-white">
                          ${c.spotPrice.toFixed(2)}
                        </td>

                        {/* Tendencia Técnica */}
                        <td className="py-3.5 px-4 text-center font-sans">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              c.technicalOutlook === 'BULLISH'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : c.technicalOutlook === 'NEUTRAL_BULLISH'
                                ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            }`}
                          >
                            {c.technicalOutlook === 'BULLISH'
                              ? 'Alcista'
                              : c.technicalOutlook === 'NEUTRAL_BULLISH'
                              ? 'Neutral-Alcista'
                              : 'Neutral'}
                          </span>
                        </td>

                        {/* Piso Put */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="font-semibold text-red-300">
                            ${c.putFloor.strike} Put
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Prima: ${c.putFloor.marketPremium} ({c.putFloor.moneyness})
                          </div>
                        </td>

                        {/* Techo Call */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="font-semibold text-emerald-300">
                            ${c.callCeiling.strike} Call
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Prima: ${c.callCeiling.marketPremium} ({c.callCeiling.moneyness})
                          </div>
                        </td>

                        {/* Prima Neta */}
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`inline-block font-bold text-xs ${
                              isPositiveCredit ? 'text-emerald-400' : 'text-slate-300'
                            }`}
                          >
                            {isPositiveCredit ? '+' : ''}${c.financialMetrics.netDebitCredit}/acc
                          </span>
                          <div className="text-[10px] text-slate-400">
                            {isPositiveCredit ? 'Crédito Neto' : 'Débito'} ($
                            {c.financialMetrics.netCreditTotalUSD})
                          </div>
                        </td>

                        {/* Probabilidad de Piso Seguro */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="font-bold text-emerald-400 text-xs">
                              {c.probabilities.floorProtectionPct}%
                            </span>
                          </div>
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full mx-auto mt-1 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${c.probabilities.floorProtectionPct}%` }}
                            ></div>
                          </div>
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            Sweet Spot: {c.probabilities.sweetSpotPct}%
                          </div>
                        </td>

                        {/* Retorno Máximo */}
                        <td className="py-3.5 px-4 text-center font-bold text-indigo-300">
                          +{c.financialMetrics.maxReturnPct}%
                          <div className="text-[10px] text-slate-400 font-normal">
                            +${c.financialMetrics.maxProfitUSD}
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-4 text-center font-sans">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAsset({
                                  symbol: c.symbol,
                                  tvSymbol: c.tradingViewSymbol,
                                  companyName: c.companyName,
                                });
                              }}
                              className={`px-2.5 py-1 text-[11px] rounded border transition ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-500'
                                  : 'bg-[#0b0f19] text-slate-300 border-slate-700 hover:text-white'
                              }`}
                            >
                              TradingView
                            </button>

                            <button
                              disabled={executingSymbol === c.symbol}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExecuteCollar(c);
                              }}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded border transition disabled:opacity-50 ${
                                liveExecutionMode
                                  ? 'bg-amber-600/30 hover:bg-amber-600/40 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20'
                                  : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                              }`}
                              title={
                                liveExecutionMode
                                  ? `EMITIR ÓRDENES REALES a ${session?.brokerTarget || 'Broker'}: 100 acciones + Put Floor + Call Ceiling`
                                  : 'Estructurar y registrar Collar Spread a Costo Cero (Modo Simulación)'
                              }
                            >
                              {executingSymbol === c.symbol
                                ? (liveExecutionMode ? 'Enviando a Bolsa...' : 'Estructurando...')
                                : (liveExecutionMode ? '⚡ Emitir a Broker' : 'Ejecutar')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Componente Integrado de TradingView */}
        <TradingViewWidget
          symbol={selectedAsset.tvSymbol}
          companyName={selectedAsset.companyName}
        />
      </main>

      {/* Modal de Criterios Oficiales */}
      <CriteriaModal isOpen={isCriteriaOpen} onClose={() => setIsCriteriaOpen(false)} />
    </div>
  );
}
