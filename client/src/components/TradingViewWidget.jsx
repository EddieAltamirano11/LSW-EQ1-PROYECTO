import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, LineChart, Gauge } from 'lucide-react';

export default function TradingViewWidget({ symbol = 'NASDAQ:AAPL', companyName = 'Apple Inc.' }) {
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const techContainerRef = useRef(null);

  // Normalizar símbolo asegurando prefijo de mercado para TradingView
  const cleanSymbol = symbol.includes(':') ? symbol : `NASDAQ:${symbol}`;

  // URL del iframe interactivo oficial de TradingView (autónomo, sin inyecciones globales que contaminen la consola)
  const chartEmbedUrl = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(
    cleanSymbol
  )}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=f1f3ef&studies=%5B%22STD%3BSMA%22%2C%22STD%3BRSI%22%5D&theme=light&style=1&timezone=Etc%2FUTC&locale=es&utm_source=localhost`;

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
  }, [isDiagnosticOpen, cleanSymbol]);

  return (
    <div className="min-w-0 p-4 sm:p-5" aria-labelledby="tradingview-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-72 items-start gap-3">
          <span className="ui-section-icon"><LineChart className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 id="tradingview-title" className="text-lg font-bold tracking-tight sm:text-xl">
              Análisis Técnico en Tiempo Real (TradingView Core)
            </h2>
            <p className="mt-1 break-words text-sm text-[var(--ui-muted)]">
              Validación de soportes, medias móviles simples (SMA 50/200) y momentum (RSI) para{' '}
              <span className="font-bold text-[var(--ui-green)]">{cleanSymbol}</span> ({companyName})
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="ui-chip text-sm font-semibold">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--ui-focus)]" aria-hidden="true" />
            TradingView Live Feed
          </span>
          <a
            href={`https://www.tradingview.com/symbols/${cleanSymbol.replace(':', '-')}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-button text-sm font-semibold"
          >
            <span>Abrir en TradingView</span>
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Gráfico TradingView Principal a 100% de Ancho */}
      <div className="space-y-4">
        <div className="min-w-0 w-full rounded-xl border border-[var(--ui-border)] bg-[var(--ui-page)] p-2">
          <iframe
            key={cleanSymbol}
            src={chartEmbedUrl}
            title={`Gráfico Interactivo TradingView - ${cleanSymbol}`}
            className="w-full rounded-lg border-none"
            style={{ height: '480px' }}
            allow="fullscreen"
          />
        </div>

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
    </div>
  );
}
