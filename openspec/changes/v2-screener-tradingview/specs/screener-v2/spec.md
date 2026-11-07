# Spec Delta: Endpoint de Escaneo y Ranking de Coberturas (Screener v2)

## Purpose

Proveer a los clientes y al frontend de React un servicio analítico de alta velocidad que escanee y clasifique el Top 5 o Top 10 de empresas para aplicar Collar Spreads con evaluación probabilística rigurosa y métricas de prima neta comparativa.

## ADDED Requirements

### Requirement: Consulta de Mejores Oportunidades de Cobertura

`GET <API_URL>/market/scanner/top-collars` SHALL aceptar parámetros de consulta opcionales:
- `limit`: Entero positivo entre 1 y 10 (valor predeterminado: `5`).
- `sortBy`: Cadena con uno de los valores `probability`, `netCredit` o `maxReturn` (valor predeterminado: `probability`).
- `dteHorizon`: Entero con horizonte de vencimiento en días: `30`, `45` o `60` (valor predeterminado: `45`).
- `broker`: Nombre del broker para extraer cotizaciones (`IBKR`, `ALPACA` o `WEBULL`).

El endpoint SHALL responder con código HTTP `200` y un objeto JSON que contenga:
- `timestamp`: Marca temporal ISO de generación del reporte.
- `criteria`: Resumen de los filtros y ordenamiento aplicados.
- `candidates`: Arreglo ordenado de candidatos conteniendo para cada elemento:
  - `rank`: Posición en el ranking (1 a $N$).
  - `symbol`: Ticker del activo (ej. `AAPL`, `MSFT`).
  - `companyName`: Denominación legal de la empresa.
  - `spotPrice`: Cotización spot actual.
  - `technicalOutlook`: Diagnóstico de tendencia (`BULLISH`, `NEUTRAL_BULLISH` o `NEUTRAL`).
  - `optimalExpiration`: Fecha de expiración calculada.
  - `dteDays`: Días efectivos hasta la expiración.
  - `putFloor`: Datos del strike de piso protector, prima de mercado, moneyness y delta.
  - `callCeiling`: Datos del strike de techo de financiamiento, prima de mercado, moneyness y delta.
  - `financialMetrics`: Objeto con `netDebitCredit`, `maxLossTotalUSD`, `maxProfitUSD`, `maxReturnPct` y `breakevenPrice`.
  - `probabilities`: Objeto con `floorProtectionPct` (probabilidad de no perder capital más allá del deducible), `sweetSpotPct` (probabilidad de expirar entre piso y techo) y `assignmentRiskPct` (probabilidad de ser asignado por subida fuerte).
  - `tradingViewSymbol`: Identificador de símbolo para incrustar en el widget de TradingView (ej. `NASDAQ:AAPL`).

#### Scenario: Obtener las 5 mejores empresas ordenadas por probabilidad
- **WHEN** se invoca `GET /api/v2/market/scanner/top-collars?limit=5&sortBy=probability`
- **THEN** responde `200` con 5 candidatos donde el primer elemento tiene la mayor `floorProtectionPct`.

#### Scenario: Obtener candidatos ordenados por mayor crédito de prima neta
- **WHEN** se invoca `GET /api/v2/market/scanner/top-collars?limit=5&sortBy=netCredit`
- **THEN** responde `200` ordenado de forma descendente por `netDebitCredit`, permitiendo identificar qué empresa paga más prima al inversionista.

#### Scenario: Rechazar parámetros de consulta inválidos
- **WHEN** se envía `limit: 50` o `sortBy: "invalido"` o `dteHorizon: 15`
- **THEN** responde `400 Bad Request` con un mensaje descriptivo del parámetro inválido.

---

### Requirement: Enrutamiento Dual `/api/v2` y Retrocompatibilidad `/api/v1`

El servidor Express SHALL montar el enrutador principal en `/api/v2` y conservar el enrutador legacy en `/api/v1`. Cualquier solicitud dirigida a `/api/v1` SHALL continuar funcionando con el comportamiento y contratos estipulados en la Unidad 2 sin alterar los resultados de las suites de prueba existentes.

#### Scenario: Acceso simultáneo a v1 y v2
- **WHEN** un cliente invoca `POST /api/v1/quant/black-scholes` y otro cliente invoca `POST /api/v2/quant/black-scholes`
- **THEN** ambas peticiones devuelven código `200` con el mismo cálculo matemático exacto.
