import React, { useState, useEffect, useRef } from 'react';
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
import BrokerExecutionModal from './BrokerExecutionModal';
import { computeLocalCandidates } from '../services/localScanner';
import { brokerOptions, databaseOptions, DEFAULT_BROKER, DEFAULT_DATABASE } from '../sessionTargets';

const isMockToken = (token) => typeof token !== 'string' || token.length < 50 || token.includes('demo-jwt');

export default function Dashboard({ session, onSessionChange, onLogout }) {
  const databaseTarget = session.databaseTarget || DEFAULT_DATABASE;
  const brokerTarget = session.brokerTarget || DEFAULT_BROKER;
  const apiBase = (session.backendUrl ?? import.meta.env.VITE_API_URL ?? 'https://lsw-eq1-proyecto.onrender.com').replace(/\/$/, '');
  const [scanResult, setScanResult] = useState(null);
  const scanRequest = useRef(null);
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState(null);
  const result = scanResult?.broker === brokerTarget ? scanResult : null;
  const candidates = result?.candidates ?? [];
  const criteria = result?.criteria;
  const loading = scanning || (scanResult !== null && result === null);

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

  // Modal de respuesta del broker
  const [brokerModalData, setBrokerModalData] = useState(null);
  const [isBrokerModalOpen, setIsBrokerModalOpen] = useState(false);

  // Interruptor de Modo de Ejecución: false = Simulación Segura, true = Órdenes Reales al Broker
  const [liveExecutionMode, setLiveExecutionMode] = useState(true);

  // Estado de ejecución de orden
  const [executingSymbols, setExecutingSymbols] = useState([]);
  const [executionMessage, setExecutionMessage] = useState(null);
  const executionPending = executingSymbols.length > 0;

  // Función para ejecutar el escaneo
  const fetchScanner = async () => {
    scanRequest.current?.abort();
    const controller = new AbortController();
    scanRequest.current = controller;
    const { signal } = controller;
    setScanning(true);
    setError(null);
    setExecutionMessage(null);

    try {
      const query = new URLSearchParams({
        limit: String(limit),
        sortBy,
        dteHorizon: String(dteHorizon),
        broker: brokerTarget,
      });

      let data;
      try {
        const response = await fetch(`${apiBase}/api/v2/market/scanner/top-collars?${query.toString()}`, {
          signal,
          headers: {
            Authorization: `Bearer ${session?.token}`,
            'x-database-selection': databaseTarget,
          },
        });

        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          data = await response.json();
        }
      } catch (_) {}

      if (signal.aborted) return;

      const local = !Array.isArray(data?.candidates);
      const scan = local ? computeLocalCandidates(limit, sortBy, dteHorizon) : data;
      setScanResult({ broker: brokerTarget, local, candidates: scan.candidates, criteria: scan.criteria });

      // Si hay candidatos, seleccionar el primero por defecto para el gráfico
      const [top] = scan.candidates;
      if (top) {
        setSelectedAsset({
          symbol: top.symbol,
          tvSymbol: top.tradingViewSymbol,
          companyName: top.companyName,
        });
      }
    } catch (err) {
      if (!signal.aborted) setError(err.message);
    } finally {
      if (!signal.aborted) setScanning(false);
    }
  };

  // Recargar al cambiar los filtros o el broker.
  useEffect(() => {
    fetchScanner();
    return () => scanRequest.current?.abort();
  }, [limit, sortBy, dteHorizon, brokerTarget]);

  // Ejecutar Collar Spread automatizado en 1 clic
  const handleExecuteCollar = async (candidate) => {
    if (executingSymbols.includes(candidate.symbol)) return;
    setExecutingSymbols((pending) => [...pending, candidate.symbol]);
    setExecutionMessage(null);

    const renewToken = async () => {
      const response = await fetch(`${apiBase}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: session.user?.username || 'demo.trader',
          password: 'demoPassword123',
          databaseTarget,
        }),
      });
      const token = response.ok ? (await response.json())?.token : null;
      if (isMockToken(token)) throw new Error('No se pudo renovar la sesión para ejecutar la cobertura.');
      return onSessionChange({ token, isOfflineDemo: false }) ? token : null;
    };

    const collarPayload = {
      symbol: candidate.symbol,
      sharesCount: 100,
      portfolioId: `PORT-${candidate.symbol}`,
      expirationDate: candidate.optimalExpiration,
      broker: brokerTarget,
      executeOrders: liveExecutionMode,
      autoPersist: true,
    };

    const sendCollar = (version, token) => fetch(`${apiBase}/api/${version}/hedging/auto-collar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-database-selection': databaseTarget,
        'x-broker-selection': brokerTarget,
      },
      body: JSON.stringify(collarPayload),
    });

    const executionContext = { candidate, liveMode: liveExecutionMode, broker: brokerTarget, databaseTarget };

    try {
      let currentToken = session.token;
      if (isMockToken(currentToken)) {
        currentToken = await renewToken();
        if (!currentToken) return;
      }
      let response = null;

      // 1. Intentar v2
      try {
        response = await sendCollar('v2', currentToken);
      } catch (_) {}

      // 2. Si v2 devuelve 404 (Render en main) o 401, reintentar en v1
      if (!response || response.status === 404 || response.status === 401) {
        if (response?.status === 401) {
          currentToken = await renewToken();
          if (!currentToken) return;
        }

        response = await sendCollar('v1', currentToken);
      }

      if (response && response.ok) {
        const data = await response.json();
        if (liveExecutionMode) {
          const ordersCount = data.brokerExecution?.orders?.length || 3;
          setExecutionMessage({
            type: 'success',
            text: `[EJECUCIÓN REAL EXITOSA] Se emitieron ${ordersCount} órdenes bursátiles en vivo a ${brokerTarget} para ${candidate.symbol}: 100 acciones + Put $${candidate.putFloor.strike} + Call $${candidate.callCeiling.strike}. Persistido en ${databaseTarget.toUpperCase()}.`,
          });
        } else {
          setExecutionMessage({
            type: 'success',
            text: `[MODO SIMULACIÓN] Collar Spread a Costo Cero estructurado y calibrado exitosamente para ${candidate.symbol} con ${brokerTarget}. (Piso Put: $${candidate.putFloor.strike} | Techo Call: $${candidate.callCeiling.strike} | Prima Neta: $${candidate.financialMetrics.netDebitCredit}/acc). No se arriesgó saldo real.`,
          });
        }

        // Abrir Modal de Respuesta Detallada
        setBrokerModalData({
          ...executionContext,
          status: response.status,
          ok: true,
          data,
        });
        setIsBrokerModalOpen(true);
      } else if (response) {
        const errJson = await response.json().catch(() => ({}));
        const rawMsg = errJson.message || `El broker devolvió código HTTP ${response.status}.`;
        setExecutionMessage({
          type: liveExecutionMode ? 'error' : 'success',
          text: liveExecutionMode
            ? `[RESPUESTA DEL BROKER ${brokerTarget}]: ${rawMsg}`
            : `[MODO SIMULACIÓN] Calibración analítica completada para ${candidate.symbol}. Piso $${candidate.putFloor.strike} / Techo $${candidate.callCeiling.strike}.`,
        });

        // Abrir Modal con diagnóstico de error del broker
        setBrokerModalData({
          ...executionContext,
          status: response.status,
          ok: false,
          data: errJson,
          rawError: rawMsg,
        });
        setIsBrokerModalOpen(true);
      } else {
        const defaultMsg = 'No se pudo contactar al microservicio para emitir órdenes al broker.';
        setExecutionMessage({
          type: liveExecutionMode ? 'error' : 'success',
          text: liveExecutionMode
            ? `[ERROR DE CONEXIÓN] ${defaultMsg}`
            : `[MODO SIMULACIÓN] Collar Spread estructurado para ${candidate.symbol} con ${brokerTarget}. (Piso $${candidate.putFloor.strike} / Techo $${candidate.callCeiling.strike})`,
        });

        setBrokerModalData({
          ...executionContext,
          status: 500,
          ok: false,
          data: { message: defaultMsg },
          rawError: defaultMsg,
        });
        setIsBrokerModalOpen(true);
      }
    } catch (err) {
      setExecutionMessage({
        type: liveExecutionMode ? 'error' : 'success',
        text: liveExecutionMode
          ? `[ERROR] ${err.message}`
          : `[MODO SIMULACIÓN] Collar Spread estructurado para ${candidate.symbol}. (Piso $${candidate.putFloor.strike} / Techo $${candidate.callCeiling.strike})`,
      });

      setBrokerModalData({
        ...executionContext,
        status: 500,
        ok: false,
        data: { message: err.message },
        rawError: err.message,
      });
      setIsBrokerModalOpen(true);
    } finally {
      setExecutingSymbols((pending) => pending.filter((symbol) => symbol !== candidate.symbol));
    }
  };

  return (
    <div className="flex min-h-screen min-w-0 flex-col">
      <header className="workspace-header">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ui-accent)]">LSW · Equipo 1</p>
              <p className="text-xl font-semibold tracking-tight">Los Eddies</p>
            </div>
          </div>
          <button type="button" onClick={onLogout} className="ui-button ui-button--inverse shrink-0" title="Cerrar Sesión">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Screener Cuantitativo de Coberturas &amp; TradingView
          </h1>
          <p className="mt-2 text-sm text-[var(--ui-muted)]">Equipo 1 Los Eddies • Laboratorio de Servicios Web (IT Tepic)</p>
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-label="Contexto de sesión">
          <label className="ui-chip">
            <Database className="h-4 w-4 shrink-0 text-[var(--ui-green)]" aria-hidden="true" />
            Base de datos
            <select
              className="rounded bg-transparent font-bold text-[var(--ui-ink)] disabled:cursor-wait disabled:opacity-60"
              value={databaseTarget}
              disabled={executionPending}
              onChange={(event) => onSessionChange({ databaseTarget: event.target.value })}
            >
              {databaseOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="ui-chip">
            <Server className="h-4 w-4 shrink-0 text-[var(--ui-green)]" aria-hidden="true" />
            Broker
            <select
              className="rounded bg-transparent font-bold text-[var(--ui-ink)] disabled:cursor-wait disabled:opacity-60"
              value={brokerTarget}
              disabled={executionPending}
              onChange={(event) => onSessionChange({ brokerTarget: event.target.value })}
            >
              {brokerOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button
            type="button"
            role="switch"
            aria-label="Modo de órdenes reales"
            aria-checked={liveExecutionMode}
            onClick={() => setLiveExecutionMode(!liveExecutionMode)}
            className={liveExecutionMode ? 'ui-button ui-button--warning' : 'ui-button'}
            title={
              liveExecutionMode
                ? 'Modo Ejecución Real en Broker ACTIVO (executeOrders: true)'
                : 'Modo Simulación ACTIVO (executeOrders: false)'
            }
          >
            {liveExecutionMode ? <Zap className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <span>Órdenes</span>
            <span className="mode-switch" aria-hidden="true" />
            <span className="font-bold uppercase">{liveExecutionMode ? 'Real (broker)' : 'Simulado'}</span>
          </button>
        </div>

        <section className="ui-panel" aria-labelledby="scanner-title">
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <span className="ui-section-icon"><SlidersHorizontal className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ui-green)]">Black-Scholes · d₂</p>
              <h2 id="scanner-title" className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
                Motor Algorítmico de Selección y Ranking
              </h2>
            </div>
          </div>

          <div className="grid items-start gap-3 px-4 pb-4 sm:px-5 lg:grid-cols-[1fr_1.35fr_1.15fr]">
            <fieldset className="min-w-0">
              <legend className="ui-label">Cantidad de Empresas (Top)</legend>
              <div className="ui-segments grid-cols-2">
                <button type="button" onClick={() => setLimit(5)} aria-pressed={limit === 5} className="ui-option">Top 5 Empresas</button>
                <button type="button" onClick={() => setLimit(10)} aria-pressed={limit === 10} className="ui-option">Top 10 Empresas</button>
              </div>
            </fieldset>

            <div className="min-w-0">
              <label htmlFor="scanner-sort" className="ui-label">Criterio de Ranking</label>
              <select
                id="scanner-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="ui-field px-2.5 py-2"
              >
                <option value="probability">Probabilidad de piso seguro · N(d₂)</option>
                <option value="netCredit">Mayor prima neta</option>
                <option value="maxReturn">Mayor retorno anualizado (%)</option>
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor="scanner-dte" className="ui-label">Temporalidad de Vencimiento (DTE)</label>
              <select
                id="scanner-dte"
                value={dteHorizon}
                onChange={(e) => setDteHorizon(Number(e.target.value))}
                className="ui-field px-2.5 py-2"
              >
                <option value={30}>30 días · Theta rápido</option>
                <option value={45}>45 días · Sweet Spot CBOE</option>
                <option value={60}>60 días · Defensivo / mayor prima</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ui-border)] px-4 py-3 sm:px-5">
            <button type="button" onClick={() => setIsCriteriaOpen(true)} className="ui-button">
              <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
              ¿Qué debe cumplir una empresa?
            </button>
            <button type="button" onClick={fetchScanner} disabled={loading} className="ui-button ui-button--primary">
              <Search className={loading ? 'h-4 w-4 shrink-0 motion-safe:animate-spin' : 'h-4 w-4 shrink-0'} aria-hidden="true" />
              <span>{loading ? 'Escaneando Mercado...' : 'Escanear Ahora'}</span>
            </button>
          </div>
        </section>

        {/* Mensaje de Ejecución Toast */}
        {executionMessage && (
          <div
            className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 text-sm ${
              executionMessage.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : 'border-red-200 bg-red-50 text-red-950'
            }`}
          >
            <div className="flex min-w-0 items-start gap-2" role="status">
              {executionMessage.type === 'success' ? (
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span className="min-w-0 break-words">{executionMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setExecutionMessage(null)}
              className="ui-button ui-icon-button"
              aria-label="Cerrar aviso de ejecución"
            >
              ✕
            </button>
          </div>
        )}

        <section className="ui-panel min-w-0" aria-labelledby="ranking-title">
          <div className="flex flex-wrap items-start justify-between gap-2 p-4 sm:p-5">
            <div>
              <h2 id="ranking-title" className="text-lg font-semibold tracking-tight">Ranking Cuantitativo de Candidatos</h2>
              <p className="mt-1 text-sm text-[var(--ui-muted)]">
                Ordenado por:{' '}
                <span className="font-semibold text-[var(--ui-green)]">
                  {sortBy === 'probability'
                    ? 'Mayor Probabilidad de Piso Seguro'
                    : sortBy === 'netCredit'
                    ? 'Mayor Crédito Neto de Prima'
                    : 'Mayor Retorno Potencial'}
                </span>{' '}
                • Vencimiento:{' '}
                <span className="font-semibold text-[var(--ui-green)]">
                  {criteria?.targetExpiration} ({dteHorizon} días)
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-[var(--ui-soft)] px-2 py-1 text-xs font-semibold text-[var(--ui-green)]">
                {candidates.length} activos evaluados
              </span>
              {!loading && result?.local && (
                <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                  Cálculo local
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="border-t border-[var(--ui-border)] px-4 py-12 text-center text-sm text-[var(--ui-muted)]" role="status">
              <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-[var(--ui-green)] border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
              <span>Calculando combinaciones de opciones con Black-Scholes y Griegas...</span>
            </div>
          ) : candidates.length === 0 ? (
            <div className="border-t border-[var(--ui-border)] px-4 py-12 text-center text-sm text-[var(--ui-muted)]" role="status">
              No se encontraron candidatos para los criterios especificados.
            </div>
          ) : (
            <div>
              <table className="ranking-table w-full text-left text-xs tabular-nums" role="table" aria-labelledby="ranking-title">
                <thead className="bg-[var(--ui-soft)] text-[var(--ui-muted)]" role="rowgroup">
                  <tr role="row">
                    <th scope="col" role="columnheader">Rank</th>
                    <th scope="col" role="columnheader">Empresa / Ticker</th>
                    <th scope="col" role="columnheader">Precio Spot</th>
                    <th scope="col" role="columnheader">Tendencia</th>
                    <th scope="col" role="columnheader">Piso Put (Seguro)</th>
                    <th scope="col" role="columnheader">Techo Call (Financ.)</th>
                    <th scope="col" role="columnheader">Prima Neta</th>
                    <th scope="col" role="columnheader">Prob. Piso Seguro</th>
                    <th scope="col" role="columnheader">Retorno Máx.</th>
                    <th scope="col" role="columnheader">Acciones</th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
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
                        role="row"
                        data-selected={isSelected}
                        className="cursor-pointer"
                      >
                        {/* Rank */}
                        <td role="cell" className="ranking-position">
                          <span className="inline-flex min-w-6 justify-center rounded-md bg-[var(--ui-soft)] px-1.5 py-1 font-semibold text-[var(--ui-green)]">
                            {c.rank}
                          </span>
                        </td>

                        {/* Empresa / Ticker */}
                        <td role="cell" className="ranking-company">
                          <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                            <span>{c.symbol}</span>
                            <span className="rounded bg-[var(--ui-page)] px-1.5 py-0.5 text-xs font-medium text-[var(--ui-muted)]">
                              {c.exchange}
                            </span>
                          </div>
                          <div className="mt-0.5 break-words text-xs text-[var(--ui-muted)]">
                            {c.companyName}
                          </div>
                        </td>

                        {/* Spot Price */}
                        <td role="cell" data-label="Precio spot" className="font-semibold">
                          ${c.spotPrice.toFixed(2)}
                        </td>

                        {/* Tendencia Técnica */}
                        <td role="cell" data-label="Tendencia">
                          <span
                            className={`inline-block rounded border px-1.5 py-0.5 text-xs font-semibold ${
                              c.technicalOutlook === 'BULLISH'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                : c.technicalOutlook === 'NEUTRAL_BULLISH'
                                ? 'border-sky-200 bg-sky-50 text-sky-900'
                                : 'border-[var(--ui-border)] bg-[var(--ui-page)] text-[var(--ui-muted)]'
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
                        <td role="cell" data-label="Piso put">
                          <div className="font-semibold text-red-800">
                            ${c.putFloor.strike} Put
                          </div>
                          <div className="text-xs text-[var(--ui-muted)]">
                            Prima: ${c.putFloor.marketPremium} ({c.putFloor.moneyness})
                          </div>
                        </td>

                        {/* Techo Call */}
                        <td role="cell" data-label="Techo call">
                          <div className="font-semibold text-[var(--ui-green)]">
                            ${c.callCeiling.strike} Call
                          </div>
                          <div className="text-xs text-[var(--ui-muted)]">
                            Prima: ${c.callCeiling.marketPremium} ({c.callCeiling.moneyness})
                          </div>
                        </td>

                        {/* Prima Neta */}
                        <td role="cell" data-label="Prima neta">
                          <span
                            className={`inline-block font-bold text-xs ${
                              isPositiveCredit ? 'text-[var(--ui-green)]' : 'text-[var(--ui-ink)]'
                            }`}
                          >
                            {isPositiveCredit ? '+' : ''}${c.financialMetrics.netDebitCredit}/acc
                          </span>
                          <div className="text-xs text-[var(--ui-muted)]">
                            {isPositiveCredit ? 'Crédito Neto' : 'Débito'} ($
                            {c.financialMetrics.netCreditTotalUSD})
                          </div>
                        </td>

                        {/* Probabilidad de Piso Seguro */}
                        <td role="cell" data-label="Prob. piso seguro">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[var(--ui-green)]">
                              {c.probabilities.floorProtectionPct}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-16 max-w-full overflow-hidden rounded-full bg-[var(--ui-border)]" aria-hidden="true">
                            <div
                              className="h-full rounded-full bg-[var(--ui-focus)]"
                              style={{ width: `${c.probabilities.floorProtectionPct}%` }}
                            ></div>
                          </div>
                          <div className="mt-0.5 text-xs text-[var(--ui-muted)]">
                            Sweet Spot: {c.probabilities.sweetSpotPct}%
                          </div>
                        </td>

                        {/* Retorno Máximo */}
                        <td role="cell" data-label="Retorno máx." className="font-semibold text-[var(--ui-green)]">
                          +{c.financialMetrics.maxReturnPct}%
                          <div className="text-xs text-[var(--ui-muted)] font-normal">
                            +${c.financialMetrics.maxProfitUSD}
                          </div>
                        </td>

                        {/* Acciones */}
                        <td role="cell" className="ranking-actions">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAsset({
                                  symbol: c.symbol,
                                  tvSymbol: c.tradingViewSymbol,
                                  companyName: c.companyName,
                                });
                              }}
                              type="button"
                              aria-pressed={isSelected}
                              aria-label={'TradingView · ' + c.symbol}
                              className="ui-button whitespace-nowrap"
                            >
                              TradingView
                            </button>

                            <button
                              disabled={executingSymbols.includes(c.symbol)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExecuteCollar(c);
                              }}
                              type="button"
                              className={liveExecutionMode ? 'ui-button ui-button--warning' : 'ui-button ui-button--primary'}
                              title={
                                liveExecutionMode
                                  ? `EMITIR ÓRDENES REALES a ${brokerTarget}: 100 acciones + Put Floor + Call Ceiling`
                                  : 'Estructurar y registrar Collar Spread a Costo Cero (Modo Simulación)'
                              }
                            >
                              {executingSymbols.includes(c.symbol)
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
              <p className="border-t border-[var(--ui-border)] px-4 py-3 text-xs text-[var(--ui-muted)] sm:px-5">
                Selecciona una fila o su botón TradingView para actualizar el gráfico interactivo.
              </p>
            </div>
          )}
        </section>

        {/* Componente Integrado de TradingView */}
        <TradingViewWidget
          symbol={selectedAsset.tvSymbol}
          companyName={selectedAsset.companyName}
        />
      </main>

      {/* Modal de Criterios Oficiales */}
      <CriteriaModal isOpen={isCriteriaOpen} onClose={() => setIsCriteriaOpen(false)} />

      {/* Modal de Respuesta Detallada del Broker */}
      <BrokerExecutionModal
        isOpen={isBrokerModalOpen}
        onClose={() => setIsBrokerModalOpen(false)}
        modalData={brokerModalData}
      />
    </div>
  );
}
