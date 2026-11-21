# Spec Delta

## MODIFIED Requirements

### Requirement: Consulta de Mejores Oportunidades de Cobertura

`GET <API_URL>/market/scanner/top-collars` SHALL aceptar parámetros de consulta opcionales:
- `limit`: Entero positivo entre 1 y 25 (valor predeterminado: `5`).
- `sortBy`: Cadena con uno de los valores `probability`, `netCredit`, `maxReturn` o `cores` (valor predeterminado: `probability`). En el servidor, `cores` ordena igual que `probability`; el panel aplica después el puntaje de los cores.
- `dteHorizon`: Entero con horizonte de vencimiento en días: `30`, `45` o `60` (valor predeterminado: `45`).
- `broker`: Nombre del broker del que se obtienen las cotizaciones (`IBKR`, `ALPACA` o `WEBULL`).
- `extraSymbols`: Lista separada por comas de tickers adicionales a evaluar.

El endpoint SHALL obtener del broker indicado el precio spot de cada activo.
- Si el broker no entrega una cotización válida de un activo, ese activo SHALL omitirse del ranking y listarse en `unavailable` con el motivo.
- El endpoint SHALL NOT sustituir esa cotización por precios de referencia, precios fijos ni valores supuestos.
- Si ningún activo tiene una cotización válida, SHALL responder `503`.

Las primas, métricas y probabilidades de cada candidato SHALL calcularse con Black-Scholes y SHALL identificarse como estimaciones teóricas, indicando el modelo, la volatilidad supuesta con su origen y la tasa libre de riesgo. No representan cotizaciones de mercado y SHALL NOT usarse como precios de órdenes.

El endpoint SHALL responder con código HTTP `200` y un objeto JSON que contenga:
- `timestamp`: Marca temporal ISO de generación del reporte.
- `criteria`: Resumen de los filtros y ordenamiento aplicados.
- `candidates`: Arreglo ordenado de candidatos conteniendo para cada elemento:
  - `rank`: Posición en el ranking (1 a $N$).
  - `symbol`: Ticker del activo (ej. `AAPL`, `MSFT`).
  - `companyName`: Denominación legal de la empresa, o `null` si la fuente no la entrega.
  - `spotPrice`: Cotización spot observada en el broker, acompañada de `spotObservedAt` y `spotSource`.
  - `optimalExpiration`: Fecha de expiración calculada.
  - `dteDays`: Días efectivos hasta la expiración.
  - `putFloor`: Strike del piso protector, prima teórica (`theoreticalPremium`), moneyness y delta.
  - `callCeiling`: Strike del techo de financiamiento, prima teórica (`theoreticalPremium`), moneyness y delta.
  - `pricing`: Modelo (`BLACK_SCHOLES`), volatilidad supuesta y su origen, tasa libre de riesgo e indicador `theoretical: true`.
  - `financialMetrics`: Objeto con `netDebitCredit`, `maxLossTotalUSD`, `maxProfitUSD`, `maxReturnPct` y `breakevenPrice`.
  - `probabilities`: Objeto con `floorProtectionPct` (probabilidad de no perder capital más allá del deducible), `sweetSpotPct` (probabilidad de expirar entre piso y techo) y `assignmentRiskPct` (probabilidad de ser asignado por subida fuerte).
  - `tradingViewSymbol`: Identificador de símbolo para incrustar en el widget de TradingView (ej. `NASDAQ:AAPL`).
- `unavailable`: Arreglo con `symbol` y `reason` de cada activo sin cotización válida.

#### Scenario: Obtener las 5 mejores empresas ordenadas por probabilidad
- **WHEN** se invoca `GET /api/v2/market/scanner/top-collars?limit=5&sortBy=probability` y el broker cotiza al menos cinco activos
- **THEN** responde `200` con 5 candidatos donde el primer elemento tiene la mayor `floorProtectionPct`.

#### Scenario: Obtener candidatos ordenados por mayor crédito de prima neta
- **WHEN** se invoca `GET /api/v2/market/scanner/top-collars?limit=5&sortBy=netCredit`
- **THEN** responde `200` ordenado de forma descendente por `netDebitCredit`, permitiendo identificar qué empresa paga más prima al inversionista.

#### Scenario: Rechazar parámetros de consulta inválidos
- **WHEN** se envía `limit: 50` o `sortBy: "invalido"` o `dteHorizon: 15`
- **THEN** responde `400 Bad Request` con un mensaje descriptivo del parámetro inválido.

#### Scenario: Activo sin cotización del broker
- **WHEN** el broker no entrega la cotización de un activo de la canasta o de `extraSymbols`, o tarda más que el límite de la consulta
- **THEN** el activo aparece en `unavailable` con el motivo y no se devuelve con un precio de referencia ni con un precio fijo

#### Scenario: Broker sin cotizaciones
- **WHEN** el broker no entrega la cotización de ningún activo
- **THEN** responde `503` con la causa

#### Scenario: Identificar valores teóricos
- **WHEN** se consulta cualquier candidato
- **THEN** sus primas aparecen como `theoreticalPremium` junto con el modelo y la volatilidad supuesta en `pricing`, y el candidato no incluye `technicalOutlook`
