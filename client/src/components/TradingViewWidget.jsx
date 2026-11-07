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
        theme: 'dark',
        style: '1',
        locale: 'es',
        toolbar_bg: '#111827',
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
      )}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=111827&studies=%5B%22STD%3BSMA%22%2C%22STD%3BRSI%22%5D&theme=dark&style=1&timezone=Etc%2FUTC&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=es&utm_source=localhost`;
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
      colorTheme: 'dark',
    });

    const widgetWrapper = document.createElement('div');
    widgetWrapper.className = 'tradingview-widget-container__widget';
    techContainerRef.current.appendChild(widgetWrapper);
    techContainerRef.current.appendChild(script);
  }, [symbol]);

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-2 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <LineChart className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white tracking-tight">
              Análisis Técnico en Tiempo Real (TradingView Core)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Validación de soportes, medias móviles simples (SMA 50/200) y momentum (RSI) para{' '}
            <span className="font-semibold text-indigo-400">{symbol}</span> ({companyName})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            TradingView Live Feed
          </span>
          <a
            href={`https://www.tradingview.com/symbols/${symbol.replace(':', '-')}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
          >
            <span>Abrir en TradingView</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Velas Japonesas */}
        <div className="lg:col-span-2 bg-[#0b0f19] border border-slate-800/80 rounded-xl overflow-hidden p-2">
          <div ref={chartContainerRef} className="w-full"></div>
        </div>

        {/* Velocímetro de Síntesis Técnica */}
        <div className="bg-[#0b0f19] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              <Gauge className="w-4 h-4 text-emerald-400" />
              <span>Diagnóstico de Algoritmo Técnico</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Síntesis combinada de osciladores de volatilidad y medias exponenciales del activo para confirmar que es apto para un Collar.
            </p>
          </div>
          <div ref={techContainerRef} className="w-full overflow-hidden flex justify-center"></div>
        </div>
      </div>
    </div>
  );
}
