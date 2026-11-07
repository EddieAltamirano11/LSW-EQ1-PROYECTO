# Proposal: Evolución a API v2 con Screener Top 5/10, TradingView y Frontend React

## Why

La versión actual de la API (`/api/v1`) procesa coberturas financieras y contratos Black-Scholes para un único símbolo a la vez (`POST /hedging/auto-collar`), exigiendo que el usuario sepa de antemano qué empresa negociar. No existe un mecanismo algorítmico que responda:
1. ¿Qué empresas del mercado califican técnicamente para estructurar un Collar Spread en este momento?
2. ¿Cuál es el Top 5 o Top 10 de candidatos ordenados por probabilidad de éxito matemático o por mayor prima neta generada?
3. ¿Cuál es la ventana de temporalidad o momento óptimo de vencimiento (DTE: 30, 45 o 60 días)?
4. ¿Cómo visualizar en vivo el análisis técnico de TradingView (medias móviles, RSI, soportes) antes de emitir la orden?

Para cumplir con las especificaciones académicas y empresariales de la Unidad 3 (Microservicios y Analítica Avanzada), se requiere migrar la infraestructura al estándar `/api/v2`, incorporar el motor analítico de screening y proveer una interfaz gráfica moderna en React desplegable en Cloudflare Pages.

## What Changes

- **Versionado Limpio a `/api/v2`**:
  - Exponer toda la superficie de rutas bajo el prefijo `/api/v2`.
  - Mantener `/api/v2` como la versión principal y `/api/v1` como alias/retrocompatibilidad en `src/app.js` para asegurar que las 61 pruebas unitarias e integrales preexistentes sigan pasando al 100%.
- **Nuevo Motor y Endpoint de Screening Cuantitativo (`GET /api/v2/market/scanner/top-collars`)**:
  - Analiza una canasta curada de activos de alta liquidez del S&P 500 y Nasdaq-100 (`AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA, AMD, SPY, QQQ`).
  - Evalúa combinaciones de Collar a Costo Cero para diferentes horizontes temporales (30, 45, 60 días).
  - Calcula la **Probabilidad de Éxito Estocástica** mediante la distribución acumulada del modelo de Black-Scholes $N(d_2)$.
  - Permite ordenar el ranking por **Mayor Probabilidad de Éxito** o por **Mayor Crédito de Prima Neta** (permitiendo identificar rápidamente si una empresa que está en el puesto #3 o #4 entrega más flujo de caja que la #1).
- **Integración con TradingView**:
  - Endpoint de soporte de metadatos técnicos y widget web oficial embebido de TradingView (`Advanced Real-Time Chart` y `Technical Analysis Widget`).
- **Frontend SPA en React (Vite + Tailwind)**:
  - Pantalla de autenticación con selección interactiva de base de datos (`mongodb` vs `supabase`) y broker (`IBKR`, `ALPACA`, `WEBULL`).
  - Dashboard interactivo con botón `Escanear Mercado (Top 5 / Top 10)`.
  - Tabla de resultados con semáforo de probabilidad, strikes recomendados y primas.
  - Gráfico interactivo en vivo de TradingView del activo seleccionado.
  - Arquitectura preparada para alojamiento en **Cloudflare Pages**.
- **Documentación y Notas de Evernote**:
  - Documentar en `NOTA_MAESTRA_EVERNOTE.md` el protocolo y criterios cuantitativos de selección de empresas (tendencia alcista, volatilidad moderada, liquidez de opciones y ausencia de reportes de ganancias).

## Capabilities

### New Capabilities

- `screener-v2`: Servicio analítico de escaneo y clasificación de activos para Collar Spreads con evaluación estocástica de probabilidad, comparación de primas y horizontes temporales.
- `tradingview-integration`: Módulo de integración técnica con los widgets de análisis en tiempo real de TradingView.
- `react-dashboard-client`: Aplicación cliente React con control de sesión, selección de persistencia políglota y visualización del screener.

### Modified Capabilities

- `api-versioning`: Enrutamiento dual en `src/app.js` dando prioridad a `/api/v2` conservando retrocompatibilidad total con `/api/v1`.

## Impact

- **Código Afectado**:
  - `src/app.js`: Inclusión de rutas v2.
  - `src/api/v2/`: Nueva capa modular de rutas, controladores y servicios (incluyendo `scanner.service.js` y `scanner.controller.js`).
  - `spec/openspec.yaml`: Publicación de los nuevos endpoints en el contrato formal OpenAPI 3.0.3.
  - `client/`: Proyecto React (Vite) para Cloudflare Pages.
  - `test/`: Nuevas pruebas unitarias para el scanner v2 y actualización del ejecutor de calidad.
- **Riesgo Operativo**: Nulo sobre producción, ya que se desarrolla en la rama `dev` y mantiene compatibilidad con `/api/v1`.
