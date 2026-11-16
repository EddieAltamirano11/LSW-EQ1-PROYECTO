import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  TrendingUp,
  Database,
  Server,
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
  ArrowRightLeft,
  X,
  Send,
  CheckCircle2,
  Layers,
  Activity,
  PlusCircle,
  Wallet,
  RefreshCw,
} from 'lucide-react';
import TradingViewWidget from './TradingViewWidget';
import CriteriaModal from './CriteriaModal';
import BrokerExecutionModal from './BrokerExecutionModal';
import StrategyScreenerPanel from './StrategyScreenerPanel';
import { brokerOptions, databaseOptions, DEFAULT_BROKER, DEFAULT_DATABASE } from '../sessionTargets';

const isMockToken = (token) => typeof token !== 'string' || token.length < 50 || token.includes('demo-jwt');

export default function Dashboard({ session, apiBase, onSessionChange, onSignIn }) {
  const databaseTarget = session.databaseTarget || DEFAULT_DATABASE;
  const brokerTarget = session.brokerTarget || DEFAULT_BROKER;
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

  // Buscador y gestor de Tickers adicionales del usuario
  const [customTicker, setCustomTicker] = useState('');
  const [customTickerLoading, setCustomTickerLoading] = useState(false);
  const [customSymbols, setCustomSymbols] = useState([]);

  // Datos sincronizados de Cores Cuantitativos (para un solo ranking integrado)
  const [screenerData, setScreenerData] = useState(null);

  // Activo seleccionado para TradingView y Terminal de Órdenes
  const [selectedAsset, setSelectedAsset] = useState({
    symbol: 'AAPL',
    tvSymbol: 'NASDAQ:AAPL',
    companyName: 'Apple Inc.',
    spotPrice: 227.5,
  });

  // Terminal de Órdenes en vivo (Estrategia activa)
  const [activeStrategyTab, setActiveStrategyTab] = useState('collar'); // 'collar' | 'protective_put' | 'equity'

  // Opciones para Protective Put
  const [putBuyUnderlying, setPutBuyUnderlying] = useState(true);
  const [putSharesCount, setPutSharesCount] = useState(100);

  // Opciones para Operar Acciones (Equity Only)
  const [equitySide, setEquitySide] = useState('BUY'); // 'BUY' | 'SELL'
  const [equityQty, setEquityQty] = useState(10);
  const [equityOrderType, setEquityOrderType] = useState('MARKET'); // 'MARKET' | 'LIMIT'
  const [equityLimitPrice, setEquityLimitPrice] = useState('');

  // Modal de criterios
  const [isCriteriaOpen, setIsCriteriaOpen] = useState(false);

  // Modal de respuesta del broker
  const [brokerModalData, setBrokerModalData] = useState(null);
  const [isBrokerModalOpen, setIsBrokerModalOpen] = useState(false);

  // Estado de ejecución de orden
  const [executingSymbols, setExecutingSymbols] = useState([]);
  const [executionMessage, setExecutionMessage] = useState(null);
  const executionPending = executingSymbols.length > 0;

  // Estado del Resumen de Portafolio en el Broker Activo
  const [portfolioAccount, setPortfolioAccount] = useState(null);
  const [portfolioPositions, setPortfolioPositions] = useState([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  // Función para consultar cuenta y posiciones en tiempo real del broker
  const fetchPortfolioSummary = async () => {
    setPortfolioLoading(true);
    try {
      const headers = {
        Authorization: `Bearer ${session?.token}`,
        'x-broker-selection': brokerTarget,
        'x-database-selection': databaseTarget,
      };

      const [accRes, posRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/broker/account?broker=${brokerTarget}`, { headers }),
        fetch(`${apiBase}/api/v1/broker/positions?broker=${brokerTarget}`, { headers }),
      ]);

      if (accRes.ok) {
        const accData = await accRes.json();
        setPortfolioAccount(accData?.account || accData);
      }
      if (posRes.ok) {
        const posData = await posRes.json();
        const rawPositions = Array.isArray(posData) ? posData : posData?.positions || [];
        setPortfolioPositions(rawPositions);
      }
    } catch (e) {
      console.error('Error al consultar resumen de portafolio:', e);
    } finally {
      setPortfolioLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioSummary();
  }, [brokerTarget]);

  // Agrupación y métricas de portafolio: acciones del activo seleccionado, top 5 y buying power
  const { selectedStockShares, selectedStockValue, top5Holdings, buyingPowerUSD } = useMemo(() => {
    const map = {};
    for (const p of portfolioPositions) {
      const sym = (p.symbol || p.assetId || '').toUpperCase();
      if (!sym) continue;
      if (!map[sym]) {
        map[sym] = {
          symbol: sym,
          qty: 0,
          marketValue: 0,
          currentPrice: Number(p.currentPrice || p.marketPrice || 0),
        };
      }
      map[sym].qty += Number(p.qty || 0);
      map[sym].marketValue += Number(p.marketValue || (Number(p.qty || 0) * (p.currentPrice || 0)));
    }

    const currentSym = (selectedAsset?.symbol || '').toUpperCase();
    const current = map[currentSym];
    const selectedStockShares = current ? current.qty : 0;
    const selectedStockValue = current ? current.marketValue : 0;

    const top5Holdings = Object.values(map)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const buyingPowerUSD = Number(portfolioAccount?.buyingPower ?? portfolioAccount?.cash ?? 0);

    return { selectedStockShares, selectedStockValue, top5Holdings, buyingPowerUSD };
  }, [portfolioPositions, selectedAsset?.symbol, portfolioAccount]);

  // Candidatos ordenados dinámicamente según el criterio activo (incluyendo Cores)
  const sortedCandidates = useMemo(() => {
    let list = [...candidates];
    if (sortBy === 'cores') {
      list.sort((a, b) => {
        const scA = screenerData?.candidates?.find(
          (item) => item.symbol.toUpperCase() === a.symbol.toUpperCase()
        );
        const scB = screenerData?.candidates?.find(
          (item) => item.symbol.toUpperCase() === b.symbol.toUpperCase()
        );
        const scoreA = scA && Number.isFinite(scA.score) ? scA.score : (scA ? 0 : -1);
        const scoreB = scB && Number.isFinite(scB.score) ? scB.score : (scB ? 0 : -1);
        return scoreB - scoreA;
      });
    } else if (sortBy === 'probability') {
      list.sort((a, b) => (b.probabilities?.floorProtectionPct || 0) - (a.probabilities?.floorProtectionPct || 0));
    } else if (sortBy === 'netCredit') {
      list.sort((a, b) => (b.financialMetrics?.netDebitCredit || 0) - (a.financialMetrics?.netDebitCredit || 0));
    } else if (sortBy === 'maxReturn') {
      list.sort((a, b) => (b.financialMetrics?.maxReturnPct || 0) - (a.financialMetrics?.maxReturnPct || 0));
    }
    return list.map((item, idx) => ({ ...item, displayRank: idx + 1 }));
  }, [candidates, sortBy, screenerData]);

  // Candidato actualmente seleccionado para operaciones
  const activeCandidate = sortedCandidates.find((c) => c.symbol === selectedAsset.symbol) || {
    symbol: selectedAsset.symbol,
    companyName: selectedAsset.companyName,
    spotPrice: Number(selectedAsset.spotPrice) || 200.0,
    referenceSpot: Number(selectedAsset.spotPrice) || 200.0,
    optimalExpiration: criteria?.targetExpiration || '2026-12-18',
    putFloor: {
      strike: Math.round((Number(selectedAsset.spotPrice) || 200.0) * 0.95),
      marketPremium: 4.5,
      moneyness: '5% OTM',
    },
    callCeiling: {
      strike: Math.round((Number(selectedAsset.spotPrice) || 200.0) * 1.05),
      marketPremium: 4.8,
      moneyness: '5% OTM',
    },
    financialMetrics: {
      netDebitCredit: 0.3,
      netCreditTotalUSD: 30.0,
      maxReturnPct: '5.2',
      maxProfitUSD: 1030,
    },
    probabilities: {
      floorProtectionPct: 92,
      sweetSpotPct: 78,
    },
  };

  // Función para renovar token ante expiración
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
    if (isMockToken(token)) throw new Error('No se pudo renovar la sesión para ejecutar la orden en el broker.');
    return onSessionChange({ token, isOfflineDemo: false }) ? token : null;
  };

  // Función para ejecutar el escaneo
  const fetchScanner = async (extraSyms = customSymbols) => {
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

      if (Array.isArray(extraSyms) && extraSyms.length > 0) {
        query.set('extraSymbols', extraSyms.join(','));
      }

      let data = null;
      let fetchError = null;
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
        } else {
          const errData = await response.json().catch(() => ({}));
          fetchError = errData.message || `Error del broker (${response.status}) al escanear mercado.`;
        }
      } catch (e) {
        if (!signal.aborted) {
          fetchError = e.message || 'Error de conexión con el escáner del broker.';
        }
      }

      if (signal.aborted) return;

      if (fetchError) {
        setError(fetchError);
      }

      const scanCandidates = Array.isArray(data?.candidates) ? data.candidates : [];
      setScanResult({ broker: brokerTarget, candidates: scanCandidates, criteria: data?.criteria || null });

      // Si hay candidatos, sincronizar el primero con TradingView
      const [top] = scanCandidates;
      if (top) {
        setSelectedAsset({
          symbol: top.symbol,
          tvSymbol: top.tradingViewSymbol,
          companyName: top.companyName,
          spotPrice: top.spotPrice,
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

  // Añadir Ticker Personalizado a la Canasta del Ranking
  const handleAddCustomTicker = async (e) => {
    e?.preventDefault();
    const cleanSym = customTicker.trim().toUpperCase();
    if (!cleanSym) return;

    if (candidates.some((c) => c.symbol.toUpperCase() === cleanSym) || customSymbols.includes(cleanSym)) {
      setExecutionMessage({
        type: 'error',
        text: `El ticker ${cleanSym} ya se encuentra incluido en el ranking.`,
      });
      return;
    }

    setCustomTickerLoading(true);
    setExecutionMessage(null);

    try {
      // 1. Obtener cotización real del broker
      const res = await fetch(`${apiBase}/api/v1/broker/quote/${cleanSym}?broker=${brokerTarget}`, {
        headers: {
          Authorization: `Bearer ${session?.token}`,
          'x-broker-selection': brokerTarget,
          'x-database-selection': databaseTarget,
        },
      });

      if (res.ok) {
        const quoteData = await res.json();
        const spotPrice = Number(quoteData.lastPrice || quoteData.price || 150.0);
        const updatedSymbols = [...customSymbols, cleanSym];
        setCustomSymbols(updatedSymbols);

        // 2. Refrescar scanner con el nuevo símbolo incluido
        await fetchScanner(updatedSymbols);

        setSelectedAsset({
          symbol: cleanSym,
          tvSymbol: `NASDAQ:${cleanSym}`,
          companyName: quoteData.companyName || `${cleanSym} Inc.`,
          spotPrice,
        });
        setExecutionMessage({
          type: 'success',
          text: `[EMPRESA AÑADIDA AL RANKING] ${cleanSym} (${quoteData.companyName || cleanSym}) cotizada en tiempo real a $${spotPrice.toFixed(2)} USD vía ${brokerTarget} agregada exitosamente al ranking.`,
        });
      } else {
        const errJson = await res.json().catch(() => ({}));
        setExecutionMessage({
          type: 'error',
          text: `[NO DISPONIBLE EN BROKER]: ${errJson.message || `No se pudo cotizar ${cleanSym} en ${brokerTarget}.`}`,
        });
      }
    } catch (err) {
      setExecutionMessage({
        type: 'error',
        text: `Error al evaluar ${cleanSym}: ${err.message}`,
      });
    } finally {
      setCustomTickerLoading(false);
      setCustomTicker('');
    }
  };

  const handleRemoveCustomTicker = (symToRemove) => {
    const updated = customSymbols.filter((s) => s !== symToRemove);
    setCustomSymbols(updated);
    fetchScanner(updated);
  };

  // 1. ACCIÓN: Ejecutar Auto-Collar (3 patas: Acciones + Put Floor + Call Ceiling)
  const handleExecuteCollar = async (targetCandidate = activeCandidate) => {
    if (executingSymbols.includes(targetCandidate.symbol)) return;
    setExecutingSymbols((pending) => [...pending, targetCandidate.symbol]);
    setExecutionMessage(null);

    const collarPayload = {
      symbol: targetCandidate.symbol,
      sharesCount: 100,
      portfolioId: `PORT-${targetCandidate.symbol}`,
      expirationDate: targetCandidate.optimalExpiration || criteria?.targetExpiration || '2026-12-18',
      broker: brokerTarget,
      executeOrders: true,
      autoPersist: true,
    };

    const sendCollar = (version, token) =>
      fetch(`${apiBase}/api/${version}/hedging/auto-collar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-database-selection': databaseTarget,
          'x-broker-selection': brokerTarget,
        },
        body: JSON.stringify(collarPayload),
      });

    const executionContext = {
      actionLabel: 'Auto-Collar en vivo',
      broker: brokerTarget,
      database: databaseTarget,
      databaseTarget: databaseTarget,
      strategyType: 'ZERO_COST_COLLAR',
      candidate: targetCandidate,
      payload: collarPayload,
    };

    try {
      let currentToken = session.token;
      if (isMockToken(currentToken)) {
        currentToken = await renewToken();
        if (!currentToken) return;
      }
      let response = null;

      try {
        response = await sendCollar('v2', currentToken);
      } catch (_) {}

      if (!response || response.status === 404 || response.status === 401) {
        if (response?.status === 401) {
          currentToken = await renewToken();
          if (!currentToken) return;
        }
        response = await sendCollar('v1', currentToken);
      }

      if (response && response.ok) {
        const data = await response.json();
        const ordersCount = data.brokerExecution?.orders?.length || 3;
        setExecutionMessage({
          type: 'success',
          text: `[AUTO-COLLAR REAL EXITOSO] Se emitieron ${ordersCount} órdenes en vivo a ${brokerTarget} para ${targetCandidate.symbol}: 100 acciones + Put $${targetCandidate.putFloor.strike} + Call $${targetCandidate.callCeiling.strike}. Persistido en ${databaseTarget.toUpperCase()}.`,
        });

        setBrokerModalData({
          ...executionContext,
          status: response.status,
          ok: true,
          data,
        });
        setIsBrokerModalOpen(true);
        fetchPortfolioSummary();
      } else if (response) {
        const errJson = await response.json().catch(() => ({}));
        const rawMsg = errJson.message || `El broker devolvió código HTTP ${response.status}.`;
        setExecutionMessage({
          type: 'error',
          text: `[RESPUESTA DEL BROKER ${brokerTarget}]: ${rawMsg}`,
        });

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
          type: 'error',
          text: `[ERROR DE CONEXIÓN] ${defaultMsg}`,
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
        type: 'error',
        text: `[ERROR] ${err.message}`,
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
      setExecutingSymbols((pending) => pending.filter((symbol) => symbol !== targetCandidate.symbol));
    }
  };

  // 2. ACCIÓN: Ejecutar Cobertura Protective Put (Suelo seguro con Put)
  const handleExecuteProtectivePut = async (targetCandidate = activeCandidate) => {
    if (executingSymbols.includes(targetCandidate.symbol)) return;
    setExecutingSymbols((pending) => [...pending, targetCandidate.symbol]);
    setExecutionMessage(null);

    const putPayload = {
      symbol: targetCandidate.symbol,
      spotPrice: targetCandidate.spotPrice || targetCandidate.referenceSpot,
      sharesCount: putSharesCount,
      putStrike: targetCandidate.putFloor?.strike || Math.round((targetCandidate.spotPrice || 200) * 0.95),
      putPremium: targetCandidate.putFloor?.marketPremium || targetCandidate.putFloor?.premium || 4.5,
      expirationDate: targetCandidate.optimalExpiration || criteria?.targetExpiration || '2026-12-18T00:00:00.000Z',
      broker: brokerTarget,
      executeOrders: true,
      buyUnderlying: putBuyUnderlying,
    };

    const executionContext = {
      actionLabel: 'Protective Put en vivo',
      broker: brokerTarget,
      database: databaseTarget,
      databaseTarget: databaseTarget,
      strategyType: 'PROTECTIVE_PUT',
      candidate: targetCandidate,
      payload: putPayload,
    };

    try {
      let currentToken = session.token;
      if (isMockToken(currentToken)) {
        currentToken = await renewToken();
        if (!currentToken) return;
      }

      const response = await fetch(`${apiBase}/api/v1/hedging/protective-put`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
          'x-database-selection': databaseTarget,
          'x-broker-selection': brokerTarget,
        },
        body: JSON.stringify(putPayload),
      });

      if (response && response.ok) {
        const data = await response.json();
        setExecutionMessage({
          type: 'success',
          text: `[PROTECTIVE PUT REAL EXITOSO] Cobertura emitida a ${brokerTarget} para ${targetCandidate.symbol}: Put Strike $${putPayload.putStrike} ${putBuyUnderlying ? `+ ${putSharesCount} acciones` : '(cobertura de acciones en cartera)'}. Persistido en ${databaseTarget.toUpperCase()}.`,
        });

        setBrokerModalData({
          ...executionContext,
          status: response.status,
          ok: true,
          data,
        });
        setIsBrokerModalOpen(true);
        fetchPortfolioSummary();
      } else {
        const errJson = await response.json().catch(() => ({}));
        const rawMsg = errJson.message || `El broker devolvió código HTTP ${response?.status}.`;
        setExecutionMessage({
          type: 'error',
          text: `[RESPUESTA DEL BROKER ${brokerTarget}]: ${rawMsg}`,
        });

        setBrokerModalData({
          ...executionContext,
          status: response ? response.status : 500,
          ok: false,
          data: errJson,
          rawError: rawMsg,
        });
        setIsBrokerModalOpen(true);
      }
    } catch (err) {
      setExecutionMessage({
        type: 'error',
        text: `[ERROR PROTECTIVE PUT] ${err.message}`,
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
      setExecutingSymbols((pending) => pending.filter((symbol) => symbol !== targetCandidate.symbol));
    }
  };

  // 3. ACCIÓN: Operar Acciones Directas (Compra o Venta de Equity)
  const handleExecuteEquityOrder = async () => {
    const symbol = selectedAsset.symbol;
    if (executingSymbols.includes(symbol)) return;
    setExecutingSymbols((pending) => [...pending, symbol]);
    setExecutionMessage(null);

    const orderPayload = {
      broker: brokerTarget,
      symbol: symbol.toUpperCase(),
      qty: Number(equityQty) || 1,
      side: equitySide.toLowerCase(),
      type: equityOrderType.toLowerCase(),
      limitPrice: equityOrderType === 'LIMIT' && equityLimitPrice ? Number(equityLimitPrice) : undefined,
      instrumentType: 'EQUITY',
      timeInForce: 'day',
    };

    const executionContext = {
      actionLabel: `Orden ${equitySide} de Acciones en vivo`,
      broker: brokerTarget,
      database: databaseTarget,
      databaseTarget: databaseTarget,
      strategyType: 'EQUITY_ORDER',
      candidate: activeCandidate,
      payload: orderPayload,
    };

    try {
      let currentToken = session.token;
      if (isMockToken(currentToken)) {
        currentToken = await renewToken();
        if (!currentToken) return;
      }

      const response = await fetch(`${apiBase}/api/v1/broker/orders?broker=${brokerTarget}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
          'x-broker-selection': brokerTarget,
          'x-database-selection': databaseTarget,
        },
        body: JSON.stringify(orderPayload),
      });

      if (response && response.ok) {
        const data = await response.json();
        setExecutionMessage({
          type: 'success',
          text: `[ORDEN DE ACCIONES EXITOSA] ${equitySide} ${orderPayload.qty} acciones de ${symbol} enviada en vivo a ${brokerTarget} (${equityOrderType}). ID: ${data.order?.id || data.id || 'Confirmada'}.`,
        });

        setBrokerModalData({
          ...executionContext,
          status: response.status,
          ok: true,
          data,
        });
        setIsBrokerModalOpen(true);
        fetchPortfolioSummary();
      } else {
        const errJson = await response.json().catch(() => ({}));
        const rawMsg = errJson.message || `El matching engine devolvió código HTTP ${response?.status}.`;
        setExecutionMessage({
          type: 'error',
          text: `[RECHAZO DEL MATCHING ENGINE ${brokerTarget}]: ${rawMsg}`,
        });

        setBrokerModalData({
          ...executionContext,
          status: response ? response.status : 500,
          ok: false,
          data: errJson,
          rawError: rawMsg,
        });
        setIsBrokerModalOpen(true);
      }
    } catch (err) {
      setExecutionMessage({
        type: 'error',
        text: `[ERROR ORDEN ACCIONES] ${err.message}`,
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
      setExecutingSymbols((pending) => pending.filter((s) => s !== symbol));
    }
  };

  return (
    <div className="flex min-w-0 flex-col bg-[var(--ui-bg)] text-[var(--ui-ink)] w-full">
      {/* HEADER GLOBAL: Contexto de Sesión Institucional */}
      <header className="border-b border-[var(--ui-border)] bg-[var(--ui-card)] px-3 py-3 sm:px-5 lg:px-6 w-full">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--ui-soft)] text-[var(--ui-green)] font-bold shadow-sm">
                <Activity className="h-5 w-5" aria-hidden="true" />
              </span>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Los Eddies Quant Terminal
              </h1>
            </div>
            <p className="text-sm text-[var(--ui-muted)] mt-0.5">
              Laboratorio de Servicios Web · Screener Cuantitativo Black-Scholes &amp; Multi-Broker LIVE
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5" aria-label="Contexto de sesión">
            <label className="ui-chip text-sm font-semibold">
              <Database className="h-4 w-4 shrink-0 text-[var(--ui-green)]" aria-hidden="true" />
              <span>Base:</span>
              <select
                className="rounded bg-transparent font-bold text-sm text-[var(--ui-ink)] disabled:cursor-wait disabled:opacity-60"
                value={databaseTarget}
                disabled={executionPending}
                onChange={(event) => onSessionChange({ databaseTarget: event.target.value })}
              >
                {databaseOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="ui-chip text-sm font-semibold">
              <Server className="h-4 w-4 shrink-0 text-[var(--ui-green)]" aria-hidden="true" />
              <span>Broker:</span>
              <select
                className="rounded bg-transparent font-bold text-sm text-[var(--ui-ink)] disabled:cursor-wait disabled:opacity-60"
                value={brokerTarget}
                disabled={executionPending}
                onChange={(event) => onSessionChange({ brokerTarget: event.target.value })}
              >
                {brokerOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div
              className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900 shadow-sm"
              title="Operación bursátil real y directa hacia el broker seleccionado"
            >
              <Zap className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
              <span>Órdenes:</span>
              <span className="font-black uppercase">Real ({brokerTarget})</span>
            </div>
          </div>
        </div>
      </header>

      {/* AVISO / TOAST DE EJECUCIÓN */}
      {executionMessage && (
        <div className="w-full px-3 pt-3 sm:px-5 lg:px-6">
          <div
            className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 text-sm shadow-sm ${
              executionMessage.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : 'border-red-200 bg-red-50 text-red-950'
            }`}
          >
            <div className="flex min-w-0 items-start gap-2" role="status">
              {executionMessage.type === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
              )}
              <span className="min-w-0 break-words font-medium">{executionMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setExecutionMessage(null)}
              className="ui-button ui-icon-button"
              aria-label="Cerrar aviso de ejecución"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL: ARQUITECTURA SANTO GRIAL (3 COLUMNAS - FLUIDA & COMPLETA) */}
      <main className="w-full px-3 py-4 sm:px-5 lg:px-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[350px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_425px] 2xl:grid-cols-[380px_minmax(0,1fr)_450px]">
          {/* ============================================================== */}
          {/* COLUMNA 1 (IZQUIERDA): MOTORES CUANTITATIVOS & PARÁMETROS      */}
          {/* ============================================================== */}
          <aside className="space-y-4">
            {/* Panel de Filtros del Screener */}
            <section className="ui-panel" aria-labelledby="controls-title">
              <div className="flex items-center gap-2.5 border-b border-[var(--ui-border)] p-3.5">
                <SlidersHorizontal className="h-5 w-5 text-[var(--ui-green)]" aria-hidden="true" />
                <h2 id="controls-title" className="text-base font-bold tracking-tight">
                  Parámetros de Escáner
                </h2>
              </div>

              <div className="space-y-4 p-4 text-sm">
                {/* Límite Top 5 / Top 10 */}
                <fieldset className="min-w-0">
                  <legend className="ui-label text-sm font-semibold">Límite de Ranking</legend>
                  <div className="ui-segments grid-cols-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setLimit(5)}
                      aria-pressed={limit === 5}
                      className="ui-option py-1.5 text-sm font-semibold"
                    >
                      Top 5
                    </button>
                    <button
                      type="button"
                      onClick={() => setLimit(10)}
                      aria-pressed={limit === 10}
                      className="ui-option py-1.5 text-sm font-semibold"
                    >
                      Top 10
                    </button>
                  </div>
                </fieldset>

                {/* Ordenamiento */}
                <div>
                  <label htmlFor="scanner-sort" className="ui-label text-sm font-semibold">
                    Criterio Cuantitativo
                  </label>
                  <select
                    id="scanner-sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="ui-field mt-1 w-full px-3 py-2 text-sm font-medium"
                  >
                    <option value="cores">Mayor Puntaje Cores (Multicriterio Institucional)</option>
                    <option value="probability">Mayor Prob. Piso Seguro · N(d₂)</option>
                    <option value="netCredit">Mayor Crédito de Prima</option>
                    <option value="maxReturn">Mayor Retorno Anualizado</option>
                  </select>
                </div>

                {/* Vencimiento DTE */}
                <div>
                  <label htmlFor="scanner-dte" className="ui-label text-sm font-semibold">
                    Horizonte DTE (Días)
                  </label>
                  <select
                    id="scanner-dte"
                    value={dteHorizon}
                    onChange={(e) => setDteHorizon(Number(e.target.value))}
                    className="ui-field mt-1 w-full px-3 py-2 text-sm font-medium"
                  >
                    <option value={30}>30 días · Aceleración Theta</option>
                    <option value={45}>45 días · CBOE Sweet Spot</option>
                    <option value={60}>60 días · Mayor Cobertura</option>
                  </select>
                </div>

                {/* Añadir Empresa al Ranking */}
                <div className="border-t border-[var(--ui-border)] pt-3.5">
                  <label htmlFor="custom-ticker-input" className="ui-label text-sm font-semibold flex items-center justify-between">
                    <span>Añadir Empresa al Ranking</span>
                    <span className="text-[11px] font-normal text-[var(--ui-muted)]">Cualquier Ticker US</span>
                  </label>
                  <form onSubmit={handleAddCustomTicker} className="mt-1 flex gap-2">
                    <input
                      id="custom-ticker-input"
                      type="text"
                      placeholder="Ej. INTC, NFLX, PLTR"
                      value={customTicker}
                      onChange={(e) => setCustomTicker(e.target.value.toUpperCase())}
                      className="ui-field min-w-0 flex-1 px-3 py-2 text-sm font-mono font-bold uppercase"
                    />
                    <button
                      type="submit"
                      disabled={customTickerLoading || !customTicker.trim()}
                      className="ui-button ui-button--primary px-3 py-2 text-sm font-bold flex items-center gap-1.5 shadow-sm"
                      title="Cotizar en tiempo real y agregar al ranking general"
                    >
                      <PlusCircle className={customTickerLoading ? 'h-4 w-4 motion-safe:animate-spin' : 'h-4 w-4'} aria-hidden="true" />
                      <span>Añadir</span>
                    </button>
                  </form>

                  {customSymbols.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
                      <span className="text-xs font-semibold text-[var(--ui-muted)] w-full">Empresas añadidas al ranking:</span>
                      {customSymbols.map((sym) => (
                        <span
                          key={sym}
                          className="inline-flex items-center gap-1 rounded bg-[var(--ui-soft)] px-2 py-0.5 text-xs font-bold text-[var(--ui-green)] border border-[var(--ui-border)] shadow-xs"
                        >
                          <span>{sym}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomTicker(sym)}
                            className="text-gray-400 hover:text-red-700 ml-0.5 font-bold"
                            title={`Quitar ${sym} del ranking`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botones de Acción */}
                <div className="space-y-2.5 border-t border-[var(--ui-border)] pt-3.5">
                  <button
                    type="button"
                    onClick={() => fetchScanner()}
                    disabled={loading}
                    className="ui-button ui-button--primary w-full justify-center py-2.5 text-sm font-bold shadow-sm"
                  >
                    <Search className={loading ? 'h-4 w-4 motion-safe:animate-spin' : 'h-4 w-4'} aria-hidden="true" />
                    <span>{loading ? 'Escaneando...' : 'Escanear Mercado'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCriteriaOpen(true)}
                    className="ui-button w-full justify-center py-2 text-sm font-medium"
                  >
                    <Info className="h-4 w-4" aria-hidden="true" />
                    <span>¿Criterios Requeridos?</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Panel de Cores Institucionales (Modular, sin ranking duplicado) */}
            <div className="space-y-2">
              <StrategyScreenerPanel
                apiBase={apiBase}
                token={session.token}
                isOfflineDemo={session.isOfflineDemo}
                limit={limit}
                dteHorizon={dteHorizon}
                extraSymbols={customSymbols}
                onSignIn={onSignIn}
                hideAssetList={true}
                onScreenerResults={(data) => {
                  setScreenerData(data);
                  setSortBy('cores'); // Reordenar el ranking automáticamente según los Cores
                }}
              />
            </div>
          </aside>

          {/* ============================================================== */}
          {/* COLUMNA 2 (CENTRAL): NÚCLEO CUANTITATIVO, GRÁFICO & RANKING     */}
          {/* ============================================================== */}
          <section className="min-w-0 space-y-4">
            {/* Gráfico TradingView Interactivo */}
            <div className="ui-panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Activity className="h-5 w-5 text-[var(--ui-green)]" aria-hidden="true" />
                  <span className="text-base sm:text-lg font-bold">{selectedAsset.symbol}</span>
                  <span className="text-sm text-[var(--ui-muted)]">{selectedAsset.companyName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-[var(--ui-soft)] px-3 py-1 text-sm font-bold text-[var(--ui-green)]">
                    Spot: ${activeCandidate.spotPrice.toFixed(2)} USD
                  </span>
                  <span className="rounded-lg bg-red-50 px-3 py-1 text-sm font-bold text-red-800 border border-red-200">
                    Piso Put: ${activeCandidate.putFloor.strike}
                  </span>
                  <span className="rounded-lg bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800 border border-emerald-200">
                    Techo Call: ${activeCandidate.callCeiling.strike}
                  </span>
                </div>
              </div>

              <TradingViewWidget
                symbol={selectedAsset.tvSymbol}
                companyName={selectedAsset.companyName}
              />
            </div>

            {/* Tabla de Ranking Unificado Institucional */}
            <section className="ui-panel min-w-0" aria-labelledby="ranking-title">
              <div className="flex flex-wrap items-center justify-between border-b border-[var(--ui-border)] px-4 py-3.5 sm:px-5">
                <div>
                  <h2 id="ranking-title" className="text-base sm:text-lg font-bold tracking-tight text-[var(--ui-ink)]">
                    Ranking Cuantitativo Institucional (Screener de Oportunidades)
                  </h2>
                  <p className="text-sm text-[var(--ui-muted)] mt-0.5">
                    Ordenado por:{' '}
                    <span className="font-semibold text-[var(--ui-green)]">
                      {sortBy === 'cores'
                        ? 'Mayor Puntaje de Cores Multicriterio (Técnico, Fundamental, Noticias, Institucional)'
                        : sortBy === 'probability'
                        ? 'Mayor Probabilidad de Piso Seguro'
                        : sortBy === 'netCredit'
                        ? 'Mayor Crédito Neto de Prima'
                        : 'Mayor Retorno Anualizado'}
                    </span>{' '}
                    • Vencimiento:{' '}
                    <span className="font-semibold text-[var(--ui-green)]">
                      {criteria?.targetExpiration} ({dteHorizon} días)
                    </span>
                  </p>
                </div>
                <span className="rounded-lg bg-[var(--ui-soft)] px-3 py-1 text-sm font-semibold text-[var(--ui-green)]">
                  {screenerData ? `${sortedCandidates.length} activos evaluados` : 'Pendiente de evaluación'}
                </span>
              </div>

              {!screenerData ? (
                <div className="px-4 py-16 text-center" role="status">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ui-soft)] text-[var(--ui-green)] border border-[var(--ui-border)] shadow-xs">
                    <Sparkles className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--ui-ink)]">
                    Ranking Cuantitativo no Evaluado
                  </h3>
                  <p className="mt-2 max-w-md mx-auto text-sm text-[var(--ui-muted)] leading-relaxed">
                    Para mostrar el ranking debe hacer clic en el botón de evaluar cores{' '}
                    <strong className="text-[var(--ui-green)] font-bold">"Consultar ranking por cores"</strong> en el panel de fuentes de la izquierda.
                  </p>
                </div>
              ) : loading ? (
                <div className="px-4 py-12 text-center text-sm text-[var(--ui-muted)]" role="status">
                  <div
                    className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-[var(--ui-green)] border-t-transparent motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                  <span>Calculando combinaciones de opciones y griegas en vivo...</span>
                </div>
              ) : sortedCandidates.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-[var(--ui-muted)]" role="status">
                  No se encontraron candidatos para los criterios especificados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="ranking-table w-full text-left text-sm tabular-nums" role="table" aria-labelledby="ranking-title">
                    <thead className="bg-[var(--ui-soft)] text-[var(--ui-muted)]" role="rowgroup">
                      <tr role="row">
                        <th scope="col" role="columnheader" className="px-3 py-3 text-xs font-bold uppercase tracking-wider">Rank</th>
                        <th scope="col" role="columnheader" className="px-3 py-3 text-xs font-bold uppercase tracking-wider">Empresa / Ticker</th>
                        <th scope="col" role="columnheader" className="px-3 py-3 text-xs font-bold uppercase tracking-wider">Precio Spot</th>
                        <th scope="col" role="columnheader" className="px-3 py-3 text-xs font-bold uppercase tracking-wider">Piso Put</th>
                        <th scope="col" role="columnheader" className="px-3 py-3 text-xs font-bold uppercase tracking-wider">Techo Call</th>
                        <th scope="col" role="columnheader" className="px-3 py-3 text-xs font-bold uppercase tracking-wider">Prima Neta</th>
                        <th scope="col" role="columnheader" className="px-3 py-3 text-xs font-bold uppercase tracking-wider">Prob. Piso N(d₂)</th>
                        <th scope="col" role="columnheader" className="px-3 py-3 text-xs font-bold uppercase tracking-wider">Retorno Máx.</th>
                        <th scope="col" role="columnheader" className="px-3 py-3 text-xs font-bold uppercase tracking-wider">Score Cores</th>
                      </tr>
                    </thead>
                    <tbody role="rowgroup">
                      {sortedCandidates.map((c) => {
                        const isSelected = selectedAsset.symbol === c.symbol;
                        const isPositiveCredit = c.financialMetrics.netDebitCredit >= 0;
                        const isCustom = c.isCustom || customSymbols.includes(c.symbol);

                        return (
                          <tr
                            key={c.symbol}
                            onClick={() =>
                              setSelectedAsset({
                                symbol: c.symbol,
                                tvSymbol: c.tradingViewSymbol,
                                companyName: c.companyName,
                                spotPrice: c.spotPrice,
                              })
                            }
                            role="row"
                            data-selected={isSelected}
                            className={`cursor-pointer transition-colors hover:bg-[var(--ui-soft)] ${
                              isSelected ? 'bg-[var(--ui-soft)] font-medium' : ''
                            }`}
                          >
                            {/* Rank */}
                            <td role="cell" className="ranking-position px-3 py-3.5">
                              <span className="inline-flex min-w-7 justify-center rounded-md bg-[var(--ui-card)] px-2 py-0.5 text-sm font-bold text-[var(--ui-green)] shadow-sm">
                                {c.displayRank ?? c.rank}
                              </span>
                            </td>

                            {/* Empresa / Ticker */}
                            <td role="cell" className="ranking-company px-3 py-3.5">
                              <div className="flex items-center gap-1.5 font-bold">
                                <span className="text-base text-[var(--ui-ink)]">{c.symbol}</span>
                                <span className="rounded bg-[var(--ui-page)] px-1.5 py-0.5 text-xs font-semibold text-[var(--ui-muted)]">
                                  {c.exchange}
                                </span>
                                {isCustom && (
                                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                                    Añadida
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-[var(--ui-muted)] mt-0.5 font-normal flex items-center gap-1.5">
                                <span>{c.companyName}</span>
                                {isCustom && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveCustomTicker(c.symbol);
                                    }}
                                    className="text-gray-400 hover:text-red-600 font-bold text-xs"
                                    title={`Quitar ${c.symbol} del ranking`}
                                  >
                                    (quitar)
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Spot Price */}
                            <td role="cell" className="px-3 py-3.5 text-base font-bold text-[var(--ui-ink)]">
                              ${c.spotPrice.toFixed(2)}
                            </td>

                            {/* Piso Put */}
                            <td role="cell" className="px-3 py-3.5">
                              <div className="text-sm font-bold text-red-800">${c.putFloor.strike} Put</div>
                              <div className="text-xs text-[var(--ui-muted)]">
                                ${c.putFloor.marketPremium}
                              </div>
                            </td>

                            {/* Techo Call */}
                            <td role="cell" className="px-3 py-3.5">
                              <div className="text-sm font-bold text-[var(--ui-green)]">${c.callCeiling.strike} Call</div>
                              <div className="text-xs text-[var(--ui-muted)]">
                                ${c.callCeiling.marketPremium}
                              </div>
                            </td>

                            {/* Prima Neta */}
                            <td role="cell" className="px-3 py-3.5">
                              <span
                                className={`text-sm font-bold ${
                                  isPositiveCredit ? 'text-[var(--ui-green)]' : 'text-[var(--ui-ink)]'
                                }`}
                              >
                                {isPositiveCredit ? '+' : ''}${c.financialMetrics.netDebitCredit}/acc
                              </span>
                            </td>

                            {/* Probabilidad */}
                            <td role="cell" className="px-3 py-3.5">
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-bold text-[var(--ui-green)]">
                                  {c.probabilities.floorProtectionPct}%
                                </span>
                              </div>
                              <div className="mt-1 h-2 w-16 overflow-hidden rounded-full bg-[var(--ui-border)]" aria-hidden="true">
                                <div
                                  className="h-full rounded-full bg-[var(--ui-focus)]"
                                  style={{ width: `${c.probabilities.floorProtectionPct}%` }}
                                ></div>
                              </div>
                            </td>

                            {/* Retorno Máx */}
                            <td role="cell" className="px-3 py-3.5 text-sm font-bold text-[var(--ui-green)]">
                              +{c.financialMetrics.maxReturnPct}%
                            </td>

                            {/* Score Cores Unificado */}
                            <td role="cell" className="px-3 py-3.5">
                              {(() => {
                                const sc = screenerData?.candidates?.find(
                                  (item) => item.symbol.toUpperCase() === c.symbol.toUpperCase()
                                );
                                if (sc) {
                                  return (
                                    <span
                                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900 border border-emerald-300 shadow-sm"
                                      title={`Viabilidad: ${sc.eligibility || 'VIABLE'} · Análisis Multicriterio Cores`}
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
                                      <span>{Number.isFinite(sc.score) ? `${sc.score.toFixed(1)}/100 · Viable` : sc.eligibility || 'Apto'}</span>
                                    </span>
                                  );
                                }
                                const ex = screenerData?.excluded?.find(
                                  (item) => item.symbol.toUpperCase() === c.symbol.toUpperCase()
                                );
                                if (ex) {
                                  return (
                                    <span
                                      className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 border border-amber-300"
                                      title={`Excluido por Cores: ${ex.reason}`}
                                    >
                                      <span>Veto Cores</span>
                                    </span>
                                  );
                                }
                                if (c.symbol === 'SPY' || c.symbol === 'QQQ') {
                                  return (
                                    <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800 border border-blue-200">
                                      Benchmark ETF
                                    </span>
                                  );
                                }
                                return <span className="text-xs text-[var(--ui-muted)]">—</span>;
                              })()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="border-t border-[var(--ui-border)] px-4 py-3 text-sm text-[var(--ui-muted)]">
                    Haz clic en cualquier fila para seleccionarla y configurar tu orden en la terminal derecha.
                  </p>
                </div>
              )}
            </section>
          </section>

          {/* ============================================================== */}
          {/* COLUMNA 3 (DERECHA): RESUMEN DE PORTAFOLIO & TERMINAL DE ORDENES */}
          {/* ============================================================== */}
          <aside className="space-y-4">
            {/* RESUMEN DE PORTAFOLIO EN VIVO */}
            <section className="ui-panel" aria-labelledby="portfolio-summary-title">
              <div className="flex items-center justify-between border-b border-[var(--ui-border)] p-3.5">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-[var(--ui-green)]" aria-hidden="true" />
                  <h2 id="portfolio-summary-title" className="text-base font-bold tracking-tight">
                    Resumen de Portafolio
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchPortfolioSummary}
                    disabled={portfolioLoading}
                    title="Actualizar tenencias y saldos en tiempo real"
                    className="rounded-lg p-1.5 text-[var(--ui-muted)] hover:text-[var(--ui-ink)] hover:bg-[var(--ui-page)] border border-[var(--ui-border)] transition-colors"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${portfolioLoading ? 'animate-spin text-[var(--ui-green)]' : ''}`} />
                  </button>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800 uppercase border border-emerald-200">
                    {brokerTarget}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-4 text-sm">
                {/* 1. Cantidad de acciones de la empresa seleccionada */}
                <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-page)] p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-semibold tracking-wider text-[var(--ui-muted)]">
                      Tenencia en {selectedAsset.symbol}:
                    </span>
                    <span className="text-xs font-medium text-[var(--ui-muted)] truncate max-w-[140px]">
                      {selectedAsset.companyName}
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <div className="text-2xl font-black text-[var(--ui-ink)]">
                      {selectedStockShares}{' '}
                      <span className="text-sm font-semibold text-[var(--ui-muted)]">acciones</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-[var(--ui-green)]">
                        ${selectedStockValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </div>
                      <div className="text-[11px] text-[var(--ui-muted)]">Valor estimado</div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 border-t border-[var(--ui-border)] pt-2 text-xs">
                    {selectedStockShares >= 100 ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Apto para Collar / Covered Call (≥100 acc.)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[var(--ui-muted)]">
                        <Info className="h-3.5 w-3.5 shrink-0" />
                        {selectedStockShares > 0
                          ? `Faltan ${100 - selectedStockShares} acc. para lote de opciones (100)`
                          : 'Sin posición abierta en esta empresa'}
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Top 5 empresas de las que más tiene acciones */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)]">
                      Top 5 Posiciones con Mayor Tenencia
                    </span>
                    <span className="text-[11px] text-[var(--ui-muted)]">
                      {top5Holdings.length} en cartera
                    </span>
                  </div>
                  {top5Holdings.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--ui-border)] p-3 text-center text-xs text-[var(--ui-muted)]">
                      {portfolioLoading ? 'Cargando posiciones del broker...' : 'No hay acciones registradas en esta cuenta.'}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {top5Holdings.map((h, idx) => {
                        const isCurrent = selectedAsset.symbol.toUpperCase() === h.symbol.toUpperCase();
                        return (
                          <button
                            key={h.symbol}
                            type="button"
                            onClick={() => {
                              setSelectedAsset({
                                symbol: h.symbol,
                                tvSymbol: `NASDAQ:${h.symbol}`,
                                companyName: h.symbol,
                                spotPrice: h.currentPrice || selectedAsset.spotPrice,
                              });
                            }}
                            className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-all ${
                              isCurrent
                                ? 'border-[var(--ui-green)] bg-emerald-50/50 shadow-sm'
                                : 'border-[var(--ui-border)] bg-[var(--ui-card)] hover:bg-[var(--ui-page)] hover:border-gray-400'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ui-page)] text-[11px] font-bold text-[var(--ui-muted)]">
                                #{idx + 1}
                              </span>
                              <div>
                                <span className="font-bold text-sm text-[var(--ui-ink)]">{h.symbol}</span>
                                {isCurrent && (
                                  <span className="ml-1.5 rounded bg-[var(--ui-green)] px-1.5 py-0.2 text-[10px] font-bold text-white">
                                    En pantalla
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-extrabold text-[var(--ui-ink)]">
                                {h.qty} <span className="font-normal text-[var(--ui-muted)]">acc</span>
                              </div>
                              <div className="text-[11px] font-medium text-[var(--ui-green)]">
                                ${h.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Buying Power (Poder de compra) */}
                <div className="rounded-xl border border-[var(--ui-border)] bg-gradient-to-br from-[var(--ui-page)] to-emerald-50/40 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-semibold tracking-wider text-[var(--ui-muted)]">
                      Poder de Compra (Buying Power):
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 rounded px-1.5 py-0.5 uppercase">
                      Fondos Disponibles
                    </span>
                  </div>
                  <div className="mt-1 text-2xl font-black text-emerald-900 tracking-tight">
                    ${buyingPowerUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    <span className="text-xs font-semibold text-[var(--ui-muted)]">USD</span>
                  </div>
                  {portfolioAccount?.cash != null && (
                    <div className="mt-1.5 flex items-center justify-between text-xs text-[var(--ui-muted)] pt-1.5 border-t border-[var(--ui-border)]">
                      <span>Efectivo Líquido (Cash):</span>
                      <span className="font-bold text-[var(--ui-ink)]">
                        ${Number(portfolioAccount.cash).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="ui-panel" aria-labelledby="terminal-title">
              <div className="flex items-center justify-between border-b border-[var(--ui-border)] p-3.5">
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-[var(--ui-green)]" aria-hidden="true" />
                  <h2 id="terminal-title" className="text-base font-bold tracking-tight">
                    Terminal de Ejecución Bursátil
                  </h2>
                </div>
                <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 uppercase border border-emerald-200">
                  {brokerTarget} LIVE
                </span>
              </div>

              {/* Ficha del Subyacente Activo */}
              <div className="border-b border-[var(--ui-border)] bg-[var(--ui-soft)] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase tracking-wider font-semibold text-[var(--ui-muted)]">Subyacente Activo:</span>
                    <div className="flex items-center gap-1.5 font-bold text-lg sm:text-xl">
                      <span>{selectedAsset.symbol}</span>
                      <span className="text-xs text-[var(--ui-muted)] font-normal">
                        ({selectedAsset.companyName})
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase tracking-wider font-semibold text-[var(--ui-muted)]">Precio Spot:</span>
                    <div className="font-black text-lg sm:text-xl text-[var(--ui-green)]">
                      ${activeCandidate.spotPrice.toFixed(2)} USD
                    </div>
                  </div>
                </div>
              </div>

              {/* Pestañas de Selección de Estrategia Bursátil */}
              <div className="p-4">
                <div className="ui-label text-sm font-semibold mb-2">Selecciona Operación Bursátil:</div>
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-page)] p-1.5 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setActiveStrategyTab('collar')}
                    className={`flex flex-col items-center gap-1.5 rounded-lg py-2.5 px-2 text-center text-xs sm:text-sm font-bold transition-all duration-150 ${
                      activeStrategyTab === 'collar'
                        ? 'bg-[var(--ui-green)] text-white shadow-md ring-2 ring-[var(--ui-green)]/40 border border-transparent'
                        : 'border border-[var(--ui-border)] bg-[var(--ui-card)] text-[var(--ui-muted)] hover:text-[var(--ui-ink)] hover:bg-white'
                    }`}
                  >
                    <Zap className={`h-4 w-4 ${activeStrategyTab === 'collar' ? 'text-emerald-300' : 'text-[var(--ui-green)]'}`} aria-hidden="true" />
                    <span className="leading-tight">Auto-Collar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStrategyTab('protective_put')}
                    className={`flex flex-col items-center gap-1.5 rounded-lg py-2.5 px-2 text-center text-xs sm:text-sm font-bold transition-all duration-150 ${
                      activeStrategyTab === 'protective_put'
                        ? 'bg-[var(--ui-green)] text-white shadow-md ring-2 ring-[var(--ui-green)]/40 border border-transparent'
                        : 'border border-[var(--ui-border)] bg-[var(--ui-card)] text-[var(--ui-muted)] hover:text-[var(--ui-ink)] hover:bg-white'
                    }`}
                  >
                    <Shield className={`h-4 w-4 ${activeStrategyTab === 'protective_put' ? 'text-emerald-300' : 'text-[var(--ui-green)]'}`} aria-hidden="true" />
                    <span className="leading-tight">Protective Put</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStrategyTab('equity')}
                    className={`flex flex-col items-center gap-1.5 rounded-lg py-2.5 px-2 text-center text-xs sm:text-sm font-bold transition-all duration-150 ${
                      activeStrategyTab === 'equity'
                        ? 'bg-[var(--ui-green)] text-white shadow-md ring-2 ring-[var(--ui-green)]/40 border border-transparent'
                        : 'border border-[var(--ui-border)] bg-[var(--ui-card)] text-[var(--ui-muted)] hover:text-[var(--ui-ink)] hover:bg-white'
                    }`}
                  >
                    <ArrowRightLeft className={`h-4 w-4 ${activeStrategyTab === 'equity' ? 'text-emerald-300' : 'text-[var(--ui-green)]'}`} aria-hidden="true" />
                    <span className="leading-tight">Acciones</span>
                  </button>
                </div>

                {/* ======================================================== */}
                {/* ESTRATEGIA 1: AUTO-COLLAR SPREAD                         */}
                {/* ======================================================== */}
                {activeStrategyTab === 'collar' && (
                  <div className="mt-4 space-y-3.5">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-sm text-emerald-950">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                        <Zap className="h-4 w-4" aria-hidden="true" />
                        <span>Estructura Zero-Cost Collar (3 Patas):</span>
                      </div>
                      <ul className="mt-2 space-y-1 text-xs sm:text-sm">
                        <li>• <strong>Subyacente:</strong> 100 acciones de {selectedAsset.symbol}</li>
                        <li>• <strong>Piso Put:</strong> Strike ${activeCandidate.putFloor.strike} (Póliza de seguro)</li>
                        <li>• <strong>Techo Call:</strong> Strike ${activeCandidate.callCeiling.strike} (Financiamiento)</li>
                        <li>• <strong>Vencimiento:</strong> {activeCandidate.optimalExpiration}</li>
                      </ul>
                    </div>

                    <div className="space-y-2 rounded-xl border border-[var(--ui-border)] p-3.5 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--ui-muted)]">Prima Neta Estimada:</span>
                        <span className="font-bold text-sm sm:text-base text-[var(--ui-green)]">
                          {activeCandidate.financialMetrics.netDebitCredit >= 0 ? '+' : ''}
                          ${activeCandidate.financialMetrics.netDebitCredit}/acc
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--ui-muted)]">Probabilidad de Piso Seguro:</span>
                        <span className="font-bold text-sm sm:text-base text-[var(--ui-green)]">
                          {activeCandidate.probabilities.floorProtectionPct}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--ui-muted)]">Retorno Máximo Estimado:</span>
                        <span className="font-bold text-sm sm:text-base text-[var(--ui-green)]">
                          +{activeCandidate.financialMetrics.maxReturnPct}%
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={executingSymbols.includes(selectedAsset.symbol)}
                      onClick={() => handleExecuteCollar(activeCandidate)}
                      className="ui-button ui-button--primary w-full justify-center py-3 text-sm sm:text-base font-bold shadow-sm"
                    >
                      <Zap className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {executingSymbols.includes(selectedAsset.symbol)
                          ? 'Enviando Órdenes a Bolsa...'
                          : `Emitir Auto-Collar a ${brokerTarget} (LIVE)`}
                      </span>
                    </button>
                  </div>
                )}

                {/* ======================================================== */}
                {/* ESTRATEGIA 2: PROTECTIVE PUT                             */}
                {/* ======================================================== */}
                {activeStrategyTab === 'protective_put' && (
                  <div className="mt-4 space-y-3.5 text-sm">
                    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3.5 text-sky-950">
                      <div className="font-bold flex items-center gap-1.5 text-sky-900">
                        <Shield className="h-4 w-4" aria-hidden="true" />
                        <span>Cobertura Protective Put (Suelo Blindado):</span>
                      </div>
                      <p className="mt-1.5 text-xs sm:text-sm leading-relaxed">
                        Protege contra caídas extremas asegurando un precio mínimo de venta (${activeCandidate.putFloor.strike} Put), manteniendo potencial alcista ilimitado.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="ui-label text-sm font-semibold">Modo de Cobertura:</label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium">
                          <input
                            type="radio"
                            name="putUnderlyingMode"
                            checked={putBuyUnderlying}
                            onChange={() => setPutBuyUnderlying(true)}
                            className="rounded-full text-[var(--ui-green)] h-4 w-4"
                          />
                          <span>Comprar acciones ({putSharesCount}) + Put protector</span>
                        </label>
                        <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium">
                          <input
                            type="radio"
                            name="putUnderlyingMode"
                            checked={!putBuyUnderlying}
                            onChange={() => setPutBuyUnderlying(false)}
                            className="rounded-full text-[var(--ui-green)] h-4 w-4"
                          />
                          <span>Cubrir acciones que ya poseo en el broker (Solo Put)</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl border border-[var(--ui-border)] p-3.5 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--ui-muted)]">Strike del Put Protector:</span>
                        <span className="font-bold text-sm sm:text-base text-red-800">${activeCandidate.putFloor.strike} USD</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--ui-muted)]">Costo de la Prima (Ask):</span>
                        <span className="font-bold text-sm sm:text-base">${activeCandidate.putFloor.marketPremium} USD/acc</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--ui-muted)]">Pérdida Máxima Blindada:</span>
                        <span className="font-bold text-sm sm:text-base text-[var(--ui-ink)]">
                          ${((activeCandidate.spotPrice - activeCandidate.putFloor.strike) + activeCandidate.putFloor.marketPremium).toFixed(2)}/acc
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={executingSymbols.includes(selectedAsset.symbol)}
                      onClick={() => handleExecuteProtectivePut(activeCandidate)}
                      className="ui-button ui-button--primary w-full justify-center py-3 text-sm sm:text-base font-bold shadow-sm"
                    >
                      <Shield className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {executingSymbols.includes(selectedAsset.symbol)
                          ? 'Enviando a Bolsa...'
                          : `Emitir Protective Put a ${brokerTarget} (LIVE)`}
                      </span>
                    </button>
                  </div>
                )}

                {/* ======================================================== */}
                {/* ESTRATEGIA 3: COMPRA / VENTA DE ACCIONES (EQUITY ONLY)   */}
                {/* ======================================================== */}
                {activeStrategyTab === 'equity' && (
                  <div className="mt-4 space-y-3.5 text-sm">
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3.5 text-indigo-950">
                      <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                        <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                        <span>Operación Simple de Acciones (Contado / Equity):</span>
                      </div>
                      <p className="mt-1.5 text-xs sm:text-sm leading-relaxed">
                        Emite una orden directa de compra o venta en el matching engine de {brokerTarget} sin opciones.
                      </p>
                    </div>

                    {/* Selector de Sentido: Compra / Venta */}
                    <div>
                      <label className="ui-label text-sm font-semibold">Sentido de la Orden:</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setEquitySide('BUY')}
                          className={`rounded-lg py-2 text-sm font-bold transition-all ${
                            equitySide === 'BUY'
                              ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-600'
                              : 'border border-[var(--ui-border)] bg-[var(--ui-card)] text-[var(--ui-muted)] hover:bg-[var(--ui-soft)]'
                          }`}
                        >
                          BUY (Comprar)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEquitySide('SELL')}
                          className={`rounded-lg py-2 text-sm font-bold transition-all ${
                            equitySide === 'SELL'
                              ? 'bg-red-600 text-white shadow-sm ring-1 ring-red-600'
                              : 'border border-[var(--ui-border)] bg-[var(--ui-card)] text-[var(--ui-muted)] hover:bg-[var(--ui-soft)]'
                          }`}
                        >
                          SELL (Vender)
                        </button>
                      </div>
                    </div>

                    {/* Cantidad y Tipo de Orden */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="ui-label text-sm font-semibold">Acciones:</label>
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          value={equityQty}
                          onChange={(e) => setEquityQty(Math.max(1, Number(e.target.value)))}
                          className="ui-field mt-1 w-full px-3 py-2 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="ui-label text-sm font-semibold">Tipo de Orden:</label>
                        <select
                          value={equityOrderType}
                          onChange={(e) => setEquityOrderType(e.target.value)}
                          className="ui-field mt-1 w-full px-2.5 py-2 text-sm font-bold"
                        >
                          <option value="MARKET">Mercado (Market)</option>
                          <option value="LIMIT">Límite (Limit)</option>
                        </select>
                      </div>
                    </div>

                    {equityOrderType === 'LIMIT' && (
                      <div>
                        <label className="ui-label text-sm font-semibold">Precio Límite (USD):</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder={activeCandidate.spotPrice.toFixed(2)}
                          value={equityLimitPrice}
                          onChange={(e) => setEquityLimitPrice(e.target.value)}
                          className="ui-field mt-1 w-full px-3 py-2 text-sm font-bold"
                        />
                      </div>
                    )}

                    <div className="space-y-2 rounded-xl border border-[var(--ui-border)] p-3.5 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--ui-muted)]">Valor Estimado:</span>
                        <span className="font-extrabold text-base text-[var(--ui-ink)]">
                          ${((Number(equityQty) || 1) * (activeCandidate.spotPrice || 0)).toFixed(2)} USD
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="text-[var(--ui-muted)]">Tiempo en Vigor:</span>
                        <span className="font-medium text-[var(--ui-muted)]">DAY (Día hábil)</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={executingSymbols.includes(selectedAsset.symbol)}
                      onClick={handleExecuteEquityOrder}
                      className="ui-button ui-button--primary w-full justify-center py-3 text-sm sm:text-base font-bold shadow-sm"
                    >
                      <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {executingSymbols.includes(selectedAsset.symbol)
                          ? 'Enviando a Bolsa...'
                          : `Emitir Orden ${equitySide} a ${brokerTarget} (LIVE)`}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </main>

      {/* FOOTER DEL SISTEMA: Estado Institucional & Conexión */}
      <footer className="mt-8 border-t border-[var(--ui-border)] bg-[var(--ui-card)] px-4 py-3.5 text-center text-sm text-[var(--ui-muted)] sm:px-6">
        <div className="mx-auto flex w-full flex-wrap items-center justify-between gap-3">
          <span className="font-medium">
            Equipo 1 Los Eddies • IT Tepic • Microservicio de Coberturas Cuantitativas (F0 &amp; F2)
          </span>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Modo Real Estricto (Cero Simulación)
            </span>
            <span>•</span>
            <span>Broker: <strong>{brokerTarget}</strong></span>
            <span>•</span>
            <span>BD: <strong>{databaseTarget.toUpperCase()}</strong></span>
          </div>
        </div>
      </footer>

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
