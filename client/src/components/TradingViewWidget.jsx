import React, { useEffect, useRef } from 'react';
import { ExternalLink, LineChart, Gauge } from 'lucide-react';

export default function TradingViewWidget({ symbol = 'NASDAQ:AAPL', companyName = 'Apple Inc.' }) {
  const chartContainerRef = useRef(null);
  const techContainerRef = useRef(null);

  // Cargar el Gráfico Interactivo Avanzado de TradingView
  useEffect(() => {
    if (!chartContainerRef.current) return;
    chartContainerRef.current.innerHTML = '';

    const containerId = `tv_chart_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const chartDiv = document.createElement('div');
    chartDiv.id = containerId;
    chartDiv.style.height = '480px';
    chartDiv.style.width = '100%';
    chartContainerRef.current.appendChild(chartDiv);

    if (window.TradingView) {
      new window.TradingView.widget({
        autosize: true,
        symbol: symbol,
        interval: 'D',
        timezone: 'Etc/UTC',
        theme: 'light',
        style: '1',
        locale: 'es',
        toolbar_bg: '#f1f3ef',
        enable_publishing: false,
        hide_top_toolbar: false,
        allow_symbol_change: true,
        save_image: false,
        container_id: containerId,
        studies: ['STD;SMA', 'STD;RSI'],
      });
    } else {
      // Fallback si la librería aún no carga
      const iframe = document.createElement('iframe');
      iframe.src = `https://s.tradingview.com/widgetembed/?frameElementId=${containerId}&symbol=${encodeURIComponent(
        symbol
      )}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3ef&studies=%5B%22STD%3BSMA%22%2C%22STD%3BRSI%22%5D&theme=light&style=1&timezone=Etc%2FUTC&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=es&utm_source=localhost`;
      iframe.title = 'Gráfico de TradingView · ' + symbol;
      iframe.style.width = '100%';
      iframe.style.height = '480px';
      iframe.style.border = 'none';
      chartContainerRef.current.appendChild(iframe);
    }
  }, [symbol]);

  // Cargar el Widget de Análisis Técnico (Velocímetro de Compra/Venta)
  useEffect(() => {
    if (!techContainerRef.current) return;
    techContainerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      interval: '1D',
      width: '100%',
      isTransparent: true,
      height: '420',
      symbol: symbol,
      showIntervalTabs: true,
      displayMode: 'single',
      locale: 'es',
      colorTheme: 'light',
    });

    const widgetWrapper = document.createElement('div');
    widgetWrapper.className = 'tradingview-widget-container__widget';
    techContainerRef.current.appendChild(widgetWrapper);
    techContainerRef.current.appendChild(script);
  }, [symbol]);

  return (
    <section className="ui-panel min-w-0 p-4 sm:p-5" aria-labelledby="tradingview-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-72 items-start gap-3">
          <span className="ui-section-icon"><LineChart className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 id="tradingview-title" className="text-lg font-semibold tracking-tight">
              Análisis Técnico en Tiempo Real (TradingView Core)
            </h2>
            <p className="mt-1 break-words text-sm text-[var(--ui-muted)]">
              Validación de soportes, medias móviles simples (SMA 50/200) y momentum (RSI) para{' '}
              <span className="font-semibold text-[var(--ui-green)]">{symbol}</span> ({companyName})
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="ui-chip">
            <span className="h-2 w-2 rounded-full bg-[var(--ui-focus)]" aria-hidden="true" />
            TradingView Live Feed
          </span>
          <a
            href={`https://www.tradingview.com/symbols/${symbol.replace(':', '-')}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-button"
          >
            <span>Abrir en TradingView</span>
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-page)] p-2">
          <div ref={chartContainerRef} className="w-full" />
        </div>
        <div className="min-w-0 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-page)] p-3 sm:p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--ui-green)]">
            <Gauge className="h-4 w-4 shrink-0" aria-hidden="true" />
            <h3>Diagnóstico de Algoritmo Técnico</h3>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-[var(--ui-muted)]">
            Síntesis combinada de osciladores de volatilidad y medias exponenciales del activo para confirmar que es apto para un Collar.
          </p>
          <div ref={techContainerRef} className="flex w-full justify-center overflow-hidden" />
        </div>
      </div>
    </section>
  );
}
