import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  const [coresError, setCoresError] = useState(null);
  const [evaluatingCores, setEvaluatingCores] = useState(false);
  const result = scanResult?.broker === brokerTarget ? scanResult : null; 
  const candidates = result?.candidates ?? [];
  const criteria = result?.criteria;
  const loading = scanning || (scanResult !== null && result === null);
  const isRankingLoading = loading || evaluatingCores;

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
  const handleScreenerResults = useCallback((data) => {
    setCoresError(null);
    setScreenerData(data);
    setSortBy('cores'); // Reordenar el ranking automáticamente según los Cores
  }, []);

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
  const [portfolioError, setPortfolioError] = useState(null);

  // Función para consultar cuenta y posiciones en tiempo real del broker
  const fetchPortfolioSummary = async (targetBroker = brokerTarget) => {
    setPortfolioLoading(true);
    setPortfolioError(null);
    try {
      const headers = {
        Authorization: `Bearer ${session?.token}`,
        'x-broker-selection': targetBroker,
        'x-database-selection': databaseTarget,
      };

      const [accRes, posRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/broker/account?broker=${targetBroker}`, { headers }),
        fetch(`${apiBase}/api/v1/broker/positions?broker=${targetBroker}`, { headers }),
      ]);

      let errorMsg = null;
      let accData = null;
      let posData = null;

      if (!accRes.ok) {
        const errJson = await accRes.json().catch(() => ({}));
        errorMsg = errJson.message || `No se pudo obtener el estado de cuenta del broker ${targetBroker} (HTTP ${accRes.status}).`;
      } else {
        accData = await accRes.json().catch(() => null);
        if (!accData) errorMsg = `Respuesta inválida al consultar cuenta de ${targetBroker}.`;
      }

      if (!errorMsg) {
        if (!posRes.ok) {
          const errJson = await posRes.json().catch(() => ({}));
          errorMsg = errJson.message || `No se pudieron obtener las posiciones del broker ${targetBroker} (HTTP ${posRes.status}).`;
        } else {
          posData = await posRes.json().catch(() => null);
        }
      }

      if (errorMsg) {
        setPortfolioError(errorMsg);
      } else {
        setPortfolioAccount(accData?.account || accData);
        const rawPositions = Array.isArray(posData) ? posData : (posData?.positions || []);
        setPortfolioPositions(rawPositions);
        setPortfolioError(null);
      }
    } catch (e) {
      console.error('Error al consultar resumen de portafolio:', e);
      setPortfolioError(e.message || `Error de conexión al consultar el broker ${targetBroker}.`);
    } finally {
      setPortfolioLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioSummary(brokerTarget);
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
      .filter((h) => h.qty > 0)
      .sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0) || b.qty - a.qty)
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
    return list.slice(0, limit).map((item, idx) => ({ ...item, displayRank: idx + 1 }));
  }, [candidates, sortBy, screenerData, limit]);

  // Control de selección manual del usuario para evitar sobreescritura indeseada
  const hasUserSelectedRef = useRef(false);

  // Al cambiar de broker, resetear la selección manual para sincronizar con el nuevo portafolio
  useEffect(() => {
    hasUserSelectedRef.current = false;
  }, [brokerTarget]);

  // Sincronizar automáticamente el activo seleccionado:
  // 1. Si el usuario tiene posiciones en su portafolio, seleccionar siempre el Top 1 de su portafolio.
  // 2. Si NO hay posiciones en su portafolio, seleccionar el Top 1 del ranking / TradingView.
  useEffect(() => {
    if (hasUserSelectedRef.current) return;

    if (top5Holdings.length > 0) {
      const topHolding = top5Holdings[0];
      const matchCand = candidates.find((c) => c.symbol.toUpperCase() === topHolding.symbol.toUpperCase());
      setSelectedAsset({
        symbol: topHolding.symbol,
        tvSymbol: matchCand ? matchCand.tradingViewSymbol : (topHolding.symbol === 'SPY' ? 'AMEX:SPY' : `NASDAQ:${topHolding.symbol}`),
        companyName: matchCand ? matchCand.companyName : `${topHolding.symbol}`,
        spotPrice: topHolding.currentPrice || matchCand?.spotPrice || 200,
      });
      return;
    }

    if (sortedCandidates.length > 0) {
      const topRank = sortedCandidates[0];
      setSelectedAsset({
        symbol: topRank.symbol,
        tvSymbol: topRank.tradingViewSymbol,
        companyName: topRank.companyName,
        spotPrice: topRank.spotPrice,
      });
    }
  }, [top5Holdings, sortedCandidates, candidates]);

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

  // =========================================================================
  // SISTEMA DE 3 SCROLLS SINCRONIZADOS A LA COLUMNA MÁS PEQUEÑA & VIEWPORT
  // =========================================================================
  const mainContainerRef = useRef(null);
  const col1InnerRef = useRef(null);
  const col2InnerRef = useRef(null);
  const col3InnerRef = useRef(null);
  const [syncedColumnHeight, setSyncedColumnHeight] = useState(null);
  const [isMultiColumn, setIsMultiColumn] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  });
  const prevHeightRef = useRef(null);
  const rafIdRef = useRef(null);

  useEffect(() => {
    const checkMultiColumn = () => {
      const isDesktop = window.innerWidth >= 1024;
      setIsMultiColumn(isDesktop);
      return isDesktop;
    };

    const updateColumnHeights = () => {
      if (typeof window === 'undefined') return;
      if (window.innerWidth < 1024) {
        if (prevHeightRef.current !== null) {
          prevHeightRef.current = null;
          setSyncedColumnHeight(null);
        }
        return;
      }

      const getInnerHeight = (ref) => {
        if (!ref?.current) return 0;
        return Math.max(
          ref.current.scrollHeight || 0,
          ref.current.offsetHeight || 0,
          Math.ceil(ref.current.getBoundingClientRect()?.height || 0)
        );
      };

      const h1 = getInnerHeight(col1InnerRef);
      const h2 = getInnerHeight(col2InnerRef);
      const h3 = getInnerHeight(col3InnerRef);

      // Esperar a que las 3 columnas hayan pintado su estructura base (mínimo 200px)
      if (h1 < 200 || h2 < 200 || h3 < 200) return;

      // Medir la altura vertical disponible en pantalla dentro de main dejando margen para el fondo gris inferior
      const availableHeight = mainContainerRef.current
        ? Math.floor(mainContainerRef.current.clientHeight - 32)
        : (window.innerHeight - 100);

      // La altura visible de las 3 columnas se adapta a la más pequeña, sin rebasar el espacio visible en pantalla
      const smallest = Math.min(h1, h2, h3);
      const target = Math.max(Math.min(smallest, availableHeight), 350);

      // Actualizar solo si hay cambio apreciable (>2px) para evitar micro-saltos
      if (prevHeightRef.current === null || Math.abs(prevHeightRef.current - target) > 2) {
        prevHeightRef.current = target;
        setSyncedColumnHeight(target);
      }
    };

    const scheduleUpdate = () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(updateColumnHeights);
    };

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleUpdate();
      });

      if (mainContainerRef.current) resizeObserver.observe(mainContainerRef.current);
      if (col1InnerRef.current) resizeObserver.observe(col1InnerRef.current);
      if (col2InnerRef.current) resizeObserver.observe(col2InnerRef.current);
      if (col3InnerRef.current) resizeObserver.observe(col3InnerRef.current);
    }

    const onWindowResize = () => {
      checkMultiColumn();
      scheduleUpdate();
    };

    window.addEventListener('resize', onWindowResize);
    scheduleUpdate();

    return () => {
      window.removeEventListener('resize', onWindowResize);
      if (resizeObserver) resizeObserver.disconnect();
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [screenerData, activeCandidate, activeStrategyTab, selectedAsset, sortedCandidates.length, loading]);

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
        limit: '25',
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
      setExecutionMessage(null);
      setBrokerModalData({
        actionLabel: `Búsqueda de ticker ${cleanSym}`,
        broker: brokerTarget,
        database: databaseTarget,
        databaseTarget: databaseTarget,
        strategyType: 'EQUITY_ORDER',
        status: 400,
        ok: false,
        data: { message: `El ticker ${cleanSym} ya se encuentra incluido en el ranking.` },
        rawError: `El ticker ${cleanSym} ya se encuentra incluido en el ranking.`,
      });
      setIsBrokerModalOpen(true);
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
        const rawMsg = errJson.message || `No se pudo cotizar ${cleanSym} en ${brokerTarget}.`;
        setExecutionMessage(null);
        setBrokerModalData({
          actionLabel: `Cotización de ticker ${cleanSym}`,
          broker: brokerTarget,
          database: databaseTarget,
          databaseTarget: databaseTarget,
          strategyType: 'EQUITY_ORDER',
          status: res.status,
          ok: false,
          data: errJson,
          rawError: rawMsg,
        });
        setIsBrokerModalOpen(true);
      }
    } catch (err) {
      setExecutionMessage(null);
      setBrokerModalData({
        actionLabel: `Cotización de ticker ${cleanSym}`,
        broker: brokerTarget,
        database: databaseTarget,
        databaseTarget: databaseTarget,
        strategyType: 'EQUITY_ORDER',
        status: 500,
        ok: false,
        data: { message: err.message },
        rawError: err.message,
      });
      setIsBrokerModalOpen(true);
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
        setExecutionMessage(null);

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
        setExecutionMessage(null);
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
      setExecutionMessage(null);
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

    // 1. Verificación preventiva de Buying Power disponible en el broker
    const buyingPower = Number(portfolioAccount?.buyingPower ?? -1);
    const estSpot = Number(targetCandidate.spotPrice || targetCandidate.referenceSpot || 200);
    const requiredStock = putBuyUnderlying ? putSharesCount * estSpot : 0;
    const putContracts = Math.max(1, Math.ceil(putSharesCount / 100));
    const putPrem = Number(targetCandidate.putFloor?.marketPremium || targetCandidate.putFloor?.premium || 4.5);
    const requiredPut = putContracts * putPrem * 100;
    const totalRequired = requiredStock + requiredPut;

    if (buyingPower >= 0 && totalRequired > buyingPower) {
      const reasonMsg = `Poder de compra insuficiente en ${brokerTarget}: La cobertura Protective Put requiere aprox. $${totalRequired.toFixed(2)} USD (${putBuyUnderlying ? `${putSharesCount} acciones ($${requiredStock.toFixed(2)}) + ` : ''}${putContracts} Put ($${requiredPut.toFixed(2)})), pero tu cuenta solo dispone de $${buyingPower.toFixed(2)} USD de Buying Power disponible.`;
      setExecutionMessage(null);
      setBrokerModalData({
        ...executionContext,
        status: 400,
        ok: false,
        data: { message: reasonMsg, reason: 'INSUFFICIENT_BUYING_POWER', required: totalRequired, buyingPower },
        rawError: reasonMsg,
      });
      setIsBrokerModalOpen(true);
      setExecutingSymbols((pending) => pending.filter((symbol) => symbol !== targetCandidate.symbol));
      return;
    }

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
        const hasExecutionErrors = (data.data?.brokerExecution?.errors?.length || 0) > 0;
        const executedOrdersCount = data.data?.brokerExecution?.orders?.length || 0;

        if (hasExecutionErrors || executedOrdersCount === 0) {
          const errorDetails = data.data?.brokerExecution?.errors?.map((e) => `[${e.legRole}]: ${e.error}`).join(' | ') || 'El matching engine rechazó las órdenes de la cobertura.';
          setExecutionMessage(null);
          setBrokerModalData({
            ...executionContext,
            status: 400,
            ok: false,
            data: { message: errorDetails, errors: data.data?.brokerExecution?.errors },
            rawError: errorDetails,
          });
          setIsBrokerModalOpen(true);
          return;
        }

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
        setExecutionMessage(null);

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
      setExecutionMessage(null);
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

      // 1. Verificación preventiva de tenencia antes de vender (Anti short-selling guard)
      if (equitySide.toUpperCase() === 'SELL') {
        let livePositions = portfolioPositions;
        try {
          const checkRes = await fetch(`${apiBase}/api/v1/broker/positions?broker=${brokerTarget}`, {
            headers: {
              Authorization: `Bearer ${currentToken}`,
              'x-broker-selection': brokerTarget,
              'x-database-selection': databaseTarget,
            },
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            livePositions = Array.isArray(checkData) ? checkData : (checkData?.positions || []);
            setPortfolioPositions(livePositions);
          }
        } catch (_) {}

        const matchingPositions = livePositions.filter(
          (p) => (p.symbol || p.assetId || '').toUpperCase() === symbol.toUpperCase()
        );
        const ownedQty = matchingPositions.reduce((acc, p) => acc + Number(p.qty || 0), 0);
        const requestedQty = Number(orderPayload.qty) || 1;

        if (ownedQty <= 0) {
          const reasonMsg = `No posees acciones de ${symbol} en tu portafolio de ${brokerTarget} (Tienes 0 acciones). Venta rechazada para evitar ventas cortas al descubierto.`;
          setExecutionMessage(null);
          setBrokerModalData({
            ...executionContext,
            status: 400,
            ok: false,
            data: { message: reasonMsg, reason: 'INSUFFICIENT_SHARES_HOLDINGS', ownedQty: 0, requestedQty },
            rawError: reasonMsg,
          });
          setIsBrokerModalOpen(true);
          return;
        }

        if (requestedQty > ownedQty) {
          const reasonMsg = `No puedes vender ${requestedQty} acciones de ${symbol}: solo posees ${ownedQty} acciones disponibles en tu cuenta de ${brokerTarget}.`;
          setExecutionMessage(null);
          setBrokerModalData({
            ...executionContext,
            status: 400,
            ok: false,
            data: { message: reasonMsg, reason: 'EXCEEDS_OWNED_SHARES', ownedQty, requestedQty },
            rawError: reasonMsg,
          });
          setIsBrokerModalOpen(true);
          return;
        }
      }

      // 2. Verificación preventiva de Buying Power antes de comprar acciones (Buying power guard)
      if (equitySide.toUpperCase() === 'BUY') {
        const buyingPower = Number(portfolioAccount?.buyingPower ?? -1);
        const estPrice = equityOrderType === 'LIMIT' && equityLimitPrice ? Number(equityLimitPrice) : Number(selectedAsset.spotPrice || 0);
        const totalEstCost = Number(orderPayload.qty) * estPrice;

        if (buyingPower >= 0 && totalEstCost > buyingPower) {
          const reasonMsg = `Poder de compra insuficiente en ${brokerTarget}: Comprar ${orderPayload.qty} acciones de ${symbol} requiere aprox. $${totalEstCost.toFixed(2)} USD, pero tu cuenta solo dispone de $${buyingPower.toFixed(2)} USD de Buying Power disponible.`;
          setExecutionMessage(null);
          setBrokerModalData({
            ...executionContext,
            status: 400,
            ok: false,
            data: { message: reasonMsg, reason: 'INSUFFICIENT_BUYING_POWER', required: totalEstCost, buyingPower },
            rawError: reasonMsg,
          });
          setIsBrokerModalOpen(true);
          return;
        }
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
        setExecutionMessage(null);

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
      setExecutionMessage(null);
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
    <div className="flex flex-col min-h-full lg:h-full lg:min-h-0 w-full lg:overflow-hidden bg-[var(--ui-bg)] text-[var(--ui-ink)]">
      {/* AVISO / TOAST DE EJECUCIÓN EXITOSA (LOS ERRORES SE MUESTRAN EXCLUSIVAMENTE EN EL MODAL, NUNCA EN EL HEADER) */}
      {executionMessage && executionMessage.type === 'success' && (
        <div className="shrink-0 w-full px-3 pt-2 sm:px-5 lg:px-6 z-10">
          <div className="flex items-start justify-between gap-3 rounded-xl border p-2.5 sm:p-3 text-xs sm:text-sm shadow-sm border-emerald-200 bg-emerald-50 text-emerald-950">
            <div className="flex min-w-0 items-start gap-2" role="status">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
              <span className="min-w-0 break-words font-medium">{executionMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setExecutionMessage(null)}
              className="ui-button ui-icon-button"
              aria-label="Cerrar aviso de ejecución"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL: ARQUITECTURA SANTO GRIAL (3 COLUMNAS - FLUIDA EN ESCRITORIO Y SCROLL VERTICAL NATURAL EN CELULARES) */}
      <main ref={mainContainerRef} className="flex-1 min-h-0 w-full p-2.5 sm:p-3.5 lg:p-5 flex flex-col overflow-y-auto lg:overflow-hidden">
        <div
          className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,11fr)_minmax(0,18fr)_minmax(0,11fr)] flex-1 min-h-0 w-full"
          style={{
            gridTemplateColumns: isMultiColumn
              ? 'minmax(0, 27.5fr) minmax(0, 45fr) minmax(0, 27.5fr)'
              : undefined,
          }}
        >
          {/* ============================================================== */}
          {/* COLUMNA 1 (IZQUIERDA): MOTORES CUANTITATIVOS & PARÁMETROS      */}
          {/* ============================================================== */}
          <aside
            style={{
              height: isMultiColumn && syncedColumnHeight ? `${syncedColumnHeight}px` : undefined,
            }}
            className="min-w-0 flex flex-col rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-xs overflow-hidden"
          >
            <div
              className="flex-1 min-h-0 no-scrollbar p-3 sm:p-3.5 overflow-visible lg:overflow-y-auto"
              style={{ overscrollBehaviorY: isMultiColumn ? 'contain' : 'auto' }}
            >
              <div ref={col1InnerRef} className="space-y-3.5 pb-2">
                {/* SELECTORES DE BROKER & BASE DE DATOS */}
              <section className="ui-panel" aria-labelledby="session-targets-title">
                <div className="flex items-center gap-2 border-b border-[var(--ui-border)] p-3">
                  <SlidersHorizontal className="h-4 w-4 text-[var(--ui-green)]" aria-hidden="true" />
                  <h2 id="session-targets-title" className="text-sm font-bold tracking-tight text-[var(--ui-ink)]">
                    Conexión &amp; Persistencia
                  </h2>
                </div>

                <div className="p-3 space-y-3 text-xs sm:text-sm">
                  {/* Selector de Broker */}
                  <div>
                    <label className="ui-label text-xs font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Server className="h-3.5 w-3.5 text-[var(--ui-green)]" aria-hidden="true" />
                        Broker Bursátil:
                      </span>
                      <span className="text-[10px] text-[var(--ui-muted)]">Mercado en vivo</span>
                    </label>
                    <select
                      value={brokerTarget}
                      disabled={executionPending}
                      onChange={(event) => onSessionChange({ brokerTarget: event.target.value })}
                      className="ui-field text-xs sm:text-sm font-bold py-1.5 px-2.5 h-9"
                    >
                      {brokerOptions.map(({ value, label, detail }) => (
                        <option key={value} value={value}>
                          {label} {detail ? `· ${detail}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selector de Base de Datos */}
                  <div>
                    <label className="ui-label text-xs font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Database className="h-3.5 w-3.5 text-[var(--ui-green)]" aria-hidden="true" />
                        Base de Datos:
                      </span>
                      <span className="text-[10px] text-[var(--ui-muted)]">Persistencia</span>
                    </label>
                    <select
                      value={databaseTarget}
                      disabled={executionPending}
                      onChange={(event) => onSessionChange({ databaseTarget: event.target.value })}
                      className="ui-field text-xs sm:text-sm font-bold py-1.5 px-2.5 h-9"
                    >
                      {databaseOptions.map(({ value, label, detail }) => (
                        <option key={value} value={value}>
                          {label} {detail || ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

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
                onEvaluatingChange={setEvaluatingCores}
                onEvaluatingError={setCoresError}
                onScreenerResults={handleScreenerResults}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* COLUMNA 2 (CENTRAL): NÚCLEO CUANTITATIVO, GRÁFICO & RANKING     */}
      {/* ============================================================== */}
      <section
        style={{
          height: isMultiColumn && syncedColumnHeight ? `${syncedColumnHeight}px` : undefined,
        }}
        className="min-w-0 flex flex-col rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-xs overflow-hidden"
      >
        <div
          className="flex-1 min-h-0 p-3 sm:p-4 no-scrollbar overflow-visible lg:overflow-y-auto"
          style={{ overscrollBehaviorY: isMultiColumn ? 'contain' : 'auto' }}
        >
          <div ref={col2InnerRef} className="space-y-4 pb-2">
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fetchScanner()}
                    disabled={isRankingLoading}
                    title="Actualizar ranking de opciones en vivo"
                    className="rounded-lg p-1.5 text-[var(--ui-muted)] hover:text-[var(--ui-ink)] hover:bg-[var(--ui-page)] border border-[var(--ui-border)] transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRankingLoading ? 'animate-spin text-[var(--ui-green)]' : ''}`} />
                  </button>
                  <span className="rounded-lg bg-[var(--ui-soft)] px-3 py-1 text-sm font-semibold text-[var(--ui-green)]">
                    {evaluatingCores ? 'Evaluando Cores en vivo...' : screenerData ? `${sortedCandidates.length} activos evaluados` : 'Pendiente de evaluación'}
                  </span>
                </div>
              </div>

              {/* Mensaje de error si falla la consulta del escáner o evaluación de Cores */}
              {(error || coresError) && !isRankingLoading && (
                <div className="p-3 bg-red-50 border-b border-red-200 text-red-900 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">
                        {coresError
                          ? 'Error al evaluar Cores Cuantitativos'
                          : `No se pudieron cargar los datos del escáner (${brokerTarget})`}
                      </p>
                      <p className="mt-0.5 text-red-800 leading-snug break-words">{coresError || error}</p>
                      <p className="mt-1 text-[11px] font-semibold text-red-700">
                        {coresError
                          ? 'Verifica las fuentes seleccionadas o reintenta la evaluación.'
                          : 'Selecciona un broker disponible en el panel de Conexión para traer los datos.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!screenerData && !evaluatingCores ? (
                <div className="px-4 py-16 text-center" role="status">
                  <h3 className="text-base sm:text-lg font-bold text-[var(--ui-ink)]">
                    Ranking Cuantitativo no Evaluado
                  </h3>
                  <p className="mt-2 max-w-md mx-auto text-sm text-[var(--ui-muted)] leading-relaxed">
                    Para mostrar el ranking debe hacer clic en el botón de{' '}
                    <strong className="text-[var(--ui-green)] font-bold">"Evaluar Cores Cuantitativos"</strong> en el panel de fuentes de la izquierda.
                  </p>
                </div>
              ) : !screenerData && evaluatingCores ? (
                <div className="px-4 py-16 text-center text-sm text-[var(--ui-muted)]" role="status">
                  <div
                    className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-[var(--ui-green)] border-t-transparent motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                  <span className="font-semibold text-[var(--ui-ink)]">Evaluando Cores Cuantitativos en vivo por primera vez...</span>
                </div>
              ) : sortedCandidates.length === 0 && isRankingLoading ? (
                <div className="px-4 py-12 text-center text-sm text-[var(--ui-muted)]" role="status">
                  <div
                    className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-[var(--ui-green)] border-t-transparent motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                  <span>Calculando combinaciones de opciones y griegas en vivo...</span>
                </div>
              ) : sortedCandidates.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-[var(--ui-muted)]" role="status">
                  {error || coresError ? 'No se pudo obtener información del broker o fuentes.' : 'No se encontraron candidatos para los criterios especificados.'}
                </div>
              ) : (
                <div className="relative">
                  {/* OVERLAY DE CARGA CON CÍRCULO GIRATORIO */}
                  {isRankingLoading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/70 dark:bg-black/40 backdrop-blur-[1px] transition-all duration-200">
                      <div
                        className="h-9 w-9 rounded-full border-3 border-[var(--ui-green)] border-t-transparent animate-spin shadow-sm"
                        aria-label="Cargando ranking de opciones"
                      />
                      <span className="mt-2.5 text-xs font-bold text-[var(--ui-ink)]">
                        {evaluatingCores
                          ? 'Recalculando ranking con Cores Cuantitativos en vivo...'
                          : `Calculando opciones y griegas (${brokerTarget})...`}
                      </span>
                    </div>
                  )}

                  {/* TABLA: SE OPACA MIENTRAS CARGA O SI HUBO ERROR */}
                  <div className={`overflow-x-auto transition-opacity duration-300 ${
                    (isRankingLoading || error || coresError) ? 'opacity-30 pointer-events-none select-none' : 'opacity-100'
                  }`}>
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
                            onClick={() => {
                              hasUserSelectedRef.current = true;
                              setSelectedAsset({
                                symbol: c.symbol,
                                tvSymbol: c.tradingViewSymbol,
                                companyName: c.companyName,
                                spotPrice: c.spotPrice,
                              });
                            }}
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
              </div>
              )}
            </section>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* COLUMNA 3 (DERECHA): RESUMEN DE PORTAFOLIO & TERMINAL DE ORDENES */}
      {/* ============================================================== */}
      <aside
        style={{
          height: isMultiColumn && syncedColumnHeight ? `${syncedColumnHeight}px` : undefined,
        }}
        className="min-w-0 flex flex-col rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-xs overflow-hidden"
      >
        <div
          className="flex-1 min-h-0 p-3 sm:p-4 no-scrollbar overflow-visible lg:overflow-y-auto"
          style={{ overscrollBehaviorY: isMultiColumn ? 'contain' : 'auto' }}
        >
          <div ref={col3InnerRef} className="space-y-4 pb-2">
            {/* RESUMEN DE PORTAFOLIO EN VIVO */}
            <section className="ui-panel relative overflow-hidden" aria-labelledby="portfolio-summary-title">
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
                    onClick={() => fetchPortfolioSummary(brokerTarget)}
                    disabled={portfolioLoading}
                    title="Actualizar tenencias y saldos en tiempo real"
                    className="rounded-lg p-1.5 text-[var(--ui-muted)] hover:text-[var(--ui-ink)] hover:bg-[var(--ui-page)] border border-[var(--ui-border)] transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${portfolioLoading ? 'animate-spin text-[var(--ui-green)]' : ''}`} />
                  </button>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase border ${
                    portfolioError
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}>
                    {brokerTarget}
                  </span>
                </div>
              </div>

              {/* CONTENEDOR CON OVERLAY DE CARGA Y ESTADO OPACO */}
              <div className="relative">
                {/* 1. OVERLAY DE CARGA: CÍRCULO GIRATORIO */}
                {portfolioLoading && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/70 dark:bg-black/40 backdrop-blur-[1.5px] transition-all duration-200 rounded-b-xl">
                    <div
                      className="h-9 w-9 rounded-full border-3 border-[var(--ui-green)] border-t-transparent animate-spin shadow-sm"
                      aria-label="Cargando datos de portafolio"
                    />
                    <span className="mt-2.5 text-xs font-bold text-[var(--ui-ink)]">
                      Consultando {brokerTarget}...
                    </span>
                  </div>
                )}

                {/* 2. AVISO EXPLICATIVO SI NO PUDO CARGAR LOS DATOS */}
                {portfolioError && !portfolioLoading && (
                  <div className="p-3 bg-red-50 border-b border-red-200 text-red-900 text-xs">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">No se pudieron cargar los datos de portafolio ({brokerTarget})</p>
                        <p className="mt-0.5 text-red-800 leading-snug break-words">{portfolioError}</p>
                        <p className="mt-1 text-[11px] font-semibold text-red-700">
                          Selecciona un broker disponible en el panel de Conexión para traer los datos.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. DATOS DE PORTAFOLIO: SE OPACAN DURANTE LA CARGA Y CONTINÚAN OPACOS SI FALLA */}
                <div className={`p-4 space-y-4 text-sm transition-opacity duration-300 ${
                  (portfolioLoading || portfolioError) ? 'opacity-30 pointer-events-none select-none' : 'opacity-100'
                }`}>
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
                                hasUserSelectedRef.current = true;
                                const matchCand = candidates.find((cand) => cand.symbol.toUpperCase() === h.symbol.toUpperCase());
                                setSelectedAsset({
                                  symbol: h.symbol,
                                  tvSymbol: matchCand ? matchCand.tradingViewSymbol : (h.symbol === 'SPY' ? 'AMEX:SPY' : `NASDAQ:${h.symbol}`),
                                  companyName: matchCand ? matchCand.companyName : h.symbol,
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

                  {/* 3. Buying Power */}
                  <div className="rounded-xl border border-[var(--ui-border)] bg-gradient-to-br from-[var(--ui-page)] to-emerald-50/40 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-semibold tracking-wider text-[var(--ui-muted)]">
                        Buying Power:
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
                        <span>Cash:</span>
                        <span className="font-bold text-[var(--ui-ink)]">
                          ${Number(portfolioAccount.cash).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </span>
                      </div>
                    )}
                  </div>
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
                    <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-page)] p-3.5 text-sm shadow-xs">
                      <div className="font-bold text-sm text-[var(--ui-ink)]">
                        <span>Estructura Zero-Cost Collar:</span>
                      </div>
                      <ul className="mt-2 space-y-1 text-xs sm:text-sm text-[var(--ui-ink)]">
                        <li>• <strong>Subyacente:</strong> 100 acciones de {selectedAsset.symbol}</li>
                        <li>• <strong>Piso Put:</strong> Strike ${activeCandidate.putFloor.strike}</li>
                        <li>• <strong>Techo Call:</strong> Strike ${activeCandidate.callCeiling.strike}</li>
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
                    <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-page)] p-3.5 text-sm shadow-xs">
                      <div className="font-bold text-sm text-[var(--ui-ink)]">
                        <span>Cobertura Protective Put:</span>
                      </div>
                      <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[var(--ui-muted)]">
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
                    <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-page)] p-3.5 text-sm shadow-xs">
                      <div className="font-bold text-sm text-[var(--ui-ink)]">
                        <span>Operación Simple de Acciones:</span>
                      </div>
                      <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[var(--ui-muted)]">
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
                          BUY
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
                          SELL
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
                          <option value="MARKET">Market</option>
                          <option value="LIMIT">Limit</option>
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
          </div>
        </div>
      </aside>
    </div>
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
