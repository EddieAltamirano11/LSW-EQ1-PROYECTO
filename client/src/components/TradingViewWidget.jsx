import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, LineChart, Gauge } from 'lucide-react';
import VistaCoreTecnico from './VistaCoreTecnico';

const VISTAS = [
  { id: 'tradingview', etiqueta: 'TradingView' },
  { id: 'tecnico', etiqueta: 'Core técnico' },
];
const CLAVE_VISTA = 'lsw.vistaCentral';

function vistaGuardada() {
  try {
    return sessionStorage.getItem(CLAVE_VISTA) === 'tecnico' ? 'tecnico' : 'tradingview';
  } catch {
    return 'tradingview';
  }
}

export default function TradingViewWidget({ symbol = 'NASDAQ:AAPL', ticker, companyName = 'Apple Inc.', apiBase = '', token, spot, cores }) {
  // TradingView es la vista por defecto; la elección se conserva mientras dure la sesión del navegador.
  const [vista, setVista] = useState(vistaGuardada);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [isChartActive, setIsChartActive] = useState(false);
  const [contenedorControles, setContenedorControles] = useState(null);
  const techContainerRef = useRef(null);
  const chartWrapperRef = useRef(null);

  // Desactivar interacción si el usuario hace clic o toca fuera del contenedor del gráfico
  useEffect(() => {
    if (!isChartActive) return;
    const handleOutsideClick = (e) => {
      if (chartWrapperRef.current && !chartWrapperRef.current.contains(e.target)) {
        setIsChartActive(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('touchstart', handleOutsideClick, { passive: true });
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isChartActive]);

  // Normalizar símbolo asegurando prefijo de mercado para TradingView
  const cleanSymbol = symbol.includes(':') ? symbol : `NASDAQ:${symbol}`;
  const tickerTecnico = (ticker || cleanSymbol.split(':').at(-1) || '').toUpperCase();

  const elegirVista = (siguiente) => {
    setVista(siguiente);
    setIsChartActive(false);
    try {
      sessionStorage.setItem(CLAVE_VISTA, siguiente);
    } catch {
      // Sin almacenamiento de sesión, la elección dura hasta recargar la página.
    }
  };

  // Estudios predeterminados: SMA y RSI (14) superpuestos en el gráfico interactivo
  const studiesParam = encodeURIComponent(JSON.stringify(['STD;SMA', 'STD;RSI']));

  // URL del iframe interactivo oficial de TradingView (autónomo, sin inyecciones globales que contaminen la consola)
  const chartEmbedUrl = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(
    cleanSymbol
  )}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=f1f3ef&studies=${studiesParam}&theme=light&style=1&timezone=Etc%2FUTC&locale=es&utm_source=localhost`;

  // Cargar el Widget de Análisis Técnico ÚNICAMENTE cuando el usuario despliega el panel
  useEffect(() => {
    if (!isDiagnosticOpen || !techContainerRef.current) return;
    techContainerRef.current.innerHTML = '';

    const containerDiv = document.createElement('div');
    containerDiv.className = 'tradingview-widget-container';
    containerDiv.style.width = '100%';

    const widgetWrapper = document.createElement('div');
    widgetWrapper.className = 'tradingview-widget-container__widget';
    containerDiv.appendChild(widgetWrapper);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      interval: '1D',
      width: '100%',
      isTransparent: true,
      height: '420',
      symbol: cleanSymbol,
      showIntervalTabs: true,
      displayMode: 'single',
      locale: 'es',
      colorTheme: 'light',
    });
    containerDiv.appendChild(script);
    techContainerRef.current.appendChild(containerDiv);

    return () => {
      if (techContainerRef.current) {
        techContainerRef.current.innerHTML = '';
      }
    };
  }, [isDiagnosticOpen, cleanSymbol, vista]);

  return (
    <div className="min-w-0 p-4 sm:p-5" aria-labelledby="tradingview-title">
      <div className="mb-2 flex items-center gap-3">
        <span className="ui-section-icon"><LineChart className="h-5 w-5" aria-hidden="true" /></span>
        <h2 id="tradingview-title" className="text-lg font-bold tracking-tight sm:text-xl">
          Trading View
        </h2>
      </div>
      <div className="ui-chart-toolbar mb-2" role="group" aria-label="Controles de la gráfica">
        <div className="ui-segments shrink-0 grid-cols-2" role="group" aria-label="Vista de la gráfica">
          {VISTAS.map(({ id, etiqueta }) => (
            <button
              key={id}
              type="button"
              aria-pressed={vista === id}
              onClick={() => elegirVista(id)}
              className="ui-option"
            >
              {etiqueta}
            </button>
          ))}
        </div>
        <a
          href={`https://www.tradingview.com/symbols/${cleanSymbol.replace(':', '-')}/`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir en TradingView"
          title="Abrir en TradingView"
          className={`ui-button shrink-0 whitespace-nowrap ${vista === 'tecnico' ? 'ui-icon-button' : ''}`}
        >
          {vista === 'tradingview' && <span>Abrir en TradingView</span>}
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
        </a>
        <div ref={setContenedorControles} className="contents" />
      </div>

      {vista === 'tecnico' ? (
        <VistaCoreTecnico
          key={tickerTecnico}
          ticker={tickerTecnico}
          apiBase={apiBase}
          token={token}
          spot={spot}
          cores={cores}
          contenedorControles={contenedorControles}
          onVolver={() => elegirVista('tradingview')}
        />
      ) : (
      /* Gráfico TradingView Principal a 100% de Ancho */
      <div className="space-y-4">
        <div
          ref={chartWrapperRef}
          className="relative min-w-0 w-full rounded-xl border border-[var(--ui-border)] bg-[var(--ui-page)] p-1.5 sm:p-2"
          onMouseLeave={() => setIsChartActive(false)}
        >
          {/* Iframe interactivo de TradingView con altura responsive para celulares y escritorio */}
          <iframe
            key={cleanSymbol}
            src={chartEmbedUrl}
            title={`Gráfico Interactivo TradingView - ${cleanSymbol}`}
            className={`ui-technical-chart rounded-lg border-none ${
              isChartActive ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
            allow="clipboard-write; fullscreen; unload"
            loading="eager"
          />

          {/* Botón flotante para desactivar interacción en celulares y reanudar scroll */}
          {isChartActive && (
            <button
              type="button"
              onClick={() => setIsChartActive(false)}
              className="absolute top-3 right-3 z-20 rounded-md bg-[var(--ui-forest)] text-white text-xs font-bold px-2.5 py-1.5 shadow-md flex items-center gap-1.5 opacity-90 hover:opacity-100"
              aria-label="Bloquear gráfico para permitir scroll"
            >
              <span>Bloquear Gráfico</span>
            </button>
          )}

          {/* Protector de Scroll 100% transparente y sin texto: permite scroll libre en la columna hasta que el usuario hace clic */}
          {!isChartActive && (
            <div
              onClick={() => setIsChartActive(true)}
              className="absolute inset-0 z-10 cursor-pointer bg-transparent"
              aria-label="Activar interacción con el gráfico"
            />
          )}
        </div>

        {/* Validación de soportes, medias y momentum justo antes del diagnóstico */}
        <p className="px-1 text-sm text-[var(--ui-muted)] break-words">
          Validación de soportes, medias móviles simples (SMA 50/200) y momentum (RSI) para{' '}
          <span className="font-bold text-[var(--ui-green)]">{cleanSymbol}</span> ({companyName})
        </p>

        {/* Diagnóstico Técnico y Osciladores (Debajo del gráfico para preservar el 100% de ancho del gráfico) */}
        <details
          className="group rounded-xl border border-[var(--ui-border)] bg-[var(--ui-page)] p-3 sm:p-4 transition-all"
          open={isDiagnosticOpen}
          onToggle={(e) => setIsDiagnosticOpen(e.currentTarget.open)}
        >
          <summary className="flex cursor-pointer items-center justify-between font-bold text-sm text-[var(--ui-green)] select-none">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 shrink-0 text-[var(--ui-green)]" aria-hidden="true" />
              <span className="text-sm sm:text-base font-bold">Diagnóstico de Algoritmo Técnico &amp; Osciladores</span>
            </div>
            <span className="text-xs font-semibold text-[var(--ui-muted)] group-open:hidden">Desplegar Diagnóstico ▼</span>
            <span className="text-xs font-semibold text-[var(--ui-muted)] hidden group-open:inline">Plegar Diagnóstico ▲</span>
          </summary>
          <p className="mt-2 mb-3 text-sm leading-relaxed text-[var(--ui-muted)]">
            Síntesis combinada de osciladores de volatilidad y medias exponenciales del activo para validar viabilidad de la estrategia.
          </p>
          <div ref={techContainerRef} className="flex w-full justify-center overflow-hidden py-2" />
        </details>
      </div>
      )}
    </div>
  );
}
