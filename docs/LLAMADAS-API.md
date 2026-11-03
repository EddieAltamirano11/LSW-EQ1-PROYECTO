# Catálogo completo de llamadas a la API

> **Proyecto:** API RESTful de Coberturas Financieras — Equipo 1 (Los Eddies)
> **Base URL local:** `http://localhost:3050/api/v1`
> **Documentación interactiva:** `http://localhost:3050/api/v1/docs`
> **Contrato crudo:** `http://localhost:3050/api/v1/spec.json`

Este documento lista **todas** las rutas implementadas en `src/`, con parámetros, cuerpos de ejemplo y `curl` listo para ejecutar. Sirve como guía de práctica en Postman o terminal.

---

## 1. Convenciones

### Variables de Postman

| Variable | Valor | Uso |
|---|---|---|
| `{{baseUrl}}` | `http://localhost:3050/api/v1` | Prefijo de todas las rutas |
| `{{accessToken}}` | JWT de `/auth/login` | Header `Authorization` (opcional) |

### Headers

| Header | Valores | Cuándo |
|---|---|---|
| `Content-Type` | `application/json` | En todo `POST`, `PUT`, `PATCH` con body |
| `x-database-selection` | `mongodb` \| `supabase` | Elegir motor de persistencia (default: `mongodb`) |
| `Authorization` | `Bearer <token>` | Opcional. Si el token es inválido responde `401` |
| `x-broker-selection` | `ALPACA` \| `WEBULL` | **Se ignora en el backend actual** (todo va a Alpaca) |

La respuesta incluye el header `X-Active-Database` con el motor usado.

### Precedencia de la base de datos

1. Header `x-database-selection`
2. Claim `dbTarget` del JWT
3. Default: `mongodb`

### Formato de error

Todos los errores pasan por el middleware centralizado:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "No se encontró la estrategia de cobertura con ID 'X' en MONGODB.",
  "timestamp": "2026-11-02T23:00:00.000Z",
  "path": "/api/v1/hedging/X",
  "activeDatabase": "mongodb"
}
```

---

## 2. Índice rápido

| Módulo | Rutas |
|---|---|
| [Sistema](#3-sistema) | 6 |
| [Auth](#4-auth) | 2 |
| [Underlyings](#5-underlyings) | 7 |
| [Hedging](#6-hedging) | 24 |
| [Strategies](#7-strategies) | 20 |
| [Analytics](#8-analytics) | 2 |
| [Quant](#9-quant) | 2 |
| [Broker](#10-broker) | 8 |
| [Market](#11-market) | 2 |

> `/hedging-strategies` es un **alias** de `/hedging`: todas las rutas de la sección 6 funcionan igual con ese prefijo.

---

## 3. Sistema

### `GET /`

Descriptor institucional del servicio.

```bash
curl http://localhost:3050/api/v1
```

### `GET /health`

Estado del servicio y de sus dependencias.

```bash
curl http://localhost:3050/api/v1/health
```

```json
{
  "status": "UP",
  "uptime": 101.06,
  "timestamp": "2026-11-02T23:17:12.268Z",
  "dependencies": {
    "mongodb": "CONNECTED",
    "supabase": "CONFIGURED",
    "alpaca": "CONFIGURED"
  },
  "activeDatabase": "mongodb"
}
```

`status` es `DEGRADED` si MongoDB no está conectado.

### `GET /spec.json`

Especificación OpenAPI/OpenSpec en JSON.

```bash
curl http://localhost:3050/api/v1/spec.json
```

### `GET /docs`

Visor interactivo Scalar (HTML).

```bash
curl http://localhost:3050/api/v1/docs
```

### `GET /docs/scalar`

Metadatos del motor de documentación.

```bash
curl http://localhost:3050/api/v1/docs/scalar
```

### `GET /docs` (raíz del servidor)

Redirige a `/api/v1/docs`.

```bash
curl -L http://localhost:3050/docs
```

---

## 4. Auth

### `POST /auth/login`

Emite un JWT. **No valida credenciales reales** (v1): cualquier usuario/contraseña no vacíos sirven. El claim `dbTarget` fija la base de datos por defecto.

**Body**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `username` | string | sí | `"eddie"` |
| `password` | string | sí | `"123"` |
| `databaseTarget` | string | no | `"mongodb"` \| `"supabase"` |

```bash
curl -X POST http://localhost:3050/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"eddie","password":"123","databaseTarget":"mongodb"}'
```

```json
{
  "message": "Autenticación exitosa y contexto de persistencia seleccionado.",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "userId": "usr-eddie", "username": "eddie", "role": "INVESTOR" },
  "activeDatabase": "mongodb"
}
```

### `GET /auth/session`

Devuelve el usuario decodificado y la BD activa.

```bash
curl http://localhost:3050/api/v1/auth/session \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 5. Underlyings

Activos subyacentes (acciones/ETF) usados por las estrategias.

### `GET /underlyings`

Lista todos los subyacentes activos.

```bash
curl http://localhost:3050/api/v1/underlyings
```

### `GET /underlyings/symbol/:symbol`

Busca por ticker (case-insensitive).

```bash
curl http://localhost:3050/api/v1/underlyings/symbol/AAPL
```

### `GET /underlyings/:id`

Busca por ID interno (`UND-AAPL-485f`, etc.).

```bash
curl http://localhost:3050/api/v1/underlyings/UND-AAPL-485f
```

### `POST /underlyings`

**Body**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `symbol` | string | sí | `"TSLA"` |
| `companyName` | string | sí | `"Tesla Inc."` |
| `spotPrice` | number | sí | `378.29` |
| `volatility` | number | no (default `0.2`) | `0.45` |
| `sector` | string | no (default `FINANCIAL`) | `"TECH"` |
| `id` | string | no | `"UND-TSLA-0001"` |

```bash
curl -X POST http://localhost:3050/api/v1/underlyings \
  -H "Content-Type: application/json" \
  -H "x-database-selection: mongodb" \
  -d '{
    "symbol": "TSLA",
    "companyName": "Tesla Inc.",
    "spotPrice": 378.29,
    "volatility": 0.45,
    "sector": "TECH"
  }'
```

> Si el ticker ya existe responde `409 Conflict`.

### `POST /underlyings/batch`

Inserta un arreglo de subyacentes.

```bash
curl -X POST http://localhost:3050/api/v1/underlyings/batch \
  -H "Content-Type: application/json" \
  -d '[
    { "symbol": "AMD", "companyName": "AMD Inc.", "spotPrice": 150.20, "volatility": 0.38 },
    { "symbol": "META", "companyName": "Meta Platforms", "spotPrice": 610.50, "volatility": 0.30 }
  ]'
```

### `PUT /underlyings/:id`

Actualización parcial. Cualquier campo del esquema.

```bash
curl -X PUT http://localhost:3050/api/v1/underlyings/UND-AAPL-485f \
  -H "Content-Type: application/json" \
  -d '{"spotPrice": 345.10, "volatility": 0.24}'
```

### `DELETE /underlyings/:id`

Borrado lógico (`deletedAt` + `active: false`).

```bash
curl -X DELETE http://localhost:3050/api/v1/underlyings/UND-AAPL-485f
```

---

## 6. Hedging

Estrategias de cobertura, patas (legs), métricas y payoff.

### `GET /hedging`

Lista estrategias. Los query params se pasan como filtro a Mongo.

| Query | Ejemplo | Descripción |
|---|---|---|
| `status` | `ACTIVE` | `ACTIVE`, `CLOSED`, `EXPIRED` |
| `portfolioId` | `PORT-01` | Cartera |
| `strategyType` | `COLLAR` | `PROTECTIVE_PUT`, `COLLAR`, `COLLAR_SPREAD` |
| `underlying.symbol` | `AAPL` | Filtro anidado |

```bash
curl "http://localhost:3050/api/v1/hedging?status=ACTIVE&strategyType=COLLAR"
curl -H "x-database-selection: supabase" "http://localhost:3050/api/v1/hedging"
```

> La base de datos se elige con el **header** `x-database-selection`, no con query string. El middleware solo lee headers y el claim del JWT.

### `GET /hedging/recommend-collar/:symbol`

Calcula un Zero-Cost Collar óptimo **sin persistir**.

| Query | Default | Ejemplo |
|---|---|---|
| `sharesCount` | `10` | `100` |
| `expiration` | +90 días | `2027-01-15` |

```bash
curl "http://localhost:3050/api/v1/hedging/recommend-collar/AAPL?sharesCount=100&expiration=2027-01-15"
```

### `GET /hedging/recommend-option/:symbol`

Recomienda **una sola pata** (PUT protector o CALL financiador) con precio teórico Black-Scholes y griegas.

| Query | Default | Valores |
|---|---|---|
| `type` | `PUT` | `PUT`, `CALL` |
| `moneyness` | `OTM` | `OTM`, `ATM`, `ITM` |
| `expiration` | +90 días | `2027-01-15` |
| `moneynessPct` | `0.05` | `0.10` (10% OTM) |
| `sharesCount` | `100` | `100` |

```bash
curl "http://localhost:3050/api/v1/hedging/recommend-option/AAPL?type=PUT&moneyness=OTM&expiration=2027-01-15"
curl "http://localhost:3050/api/v1/hedging/recommend-option/AAPL?type=CALL&moneyness=OTM&expiration=2027-01-15"
```

Respuesta (resumida):

```json
{
  "message": "Recomendación PUT OTM para AAPL calculada exitosamente.",
  "symbol": "AAPL",
  "spotPrice": 338.95,
  "expirationDate": "2027-01-15",
  "timeToExpirationYears": 0.2001,
  "optionType": "PUT",
  "moneyness": "OTM",
  "recommendation": {
    "contractSymbol": "AAPL270115P00320000",
    "strike": 320,
    "marketPremium": 2.11,
    "bid": 2.01,
    "ask": 2.21,
    "contractsNeeded": 1,
    "totalCostUSD": 211,
    "theoreticalPriceBS": 5.0296,
    "greeks": { "delta": -0.2384, "gamma": 0.00908, "theta": -0.0618, "vega": 0.4696, "rho": -0.1718 },
    "premiumRatio": 0.42,
    "fairPrice": true,
    "guardrail": "VALIDADO_JUSTO (ratio 0.42 <= 6)",
    "role": "HEDGE_FLOOR (Póliza de Seguro Protector)"
  }
}
```

### `POST /hedging/auto-collar`

Calibra y **persiste** un Collar a costo cero usando cotización y cadena de opciones del broker.

**Body**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `symbol` | string | sí | `"AAPL"` |
| `sharesCount` | integer | no (default `10`) | `100` |
| `portfolioId` | string | no (default `PORT-01`) | `"PORT-AUTO-01"` |
| `expirationDate` | string | no (+90 días) | `"2027-01-15"` |
| `autoPersist` | boolean | no (default `true`) | `false` |

```bash
curl -X POST http://localhost:3050/api/v1/hedging/auto-collar \
  -H "Content-Type: application/json" \
  -H "x-database-selection: supabase" \
  -d '{
    "symbol": "AAPL",
    "sharesCount": 100,
    "portfolioId": "PORT-AUTO-01",
    "expirationDate": "2027-01-15"
  }'
```

> `autoPersist: false` devuelve solo el análisis, sin guardar.

### `POST /hedging/auto-collar/:symbol`

Igual que el anterior, con el símbolo en la URL.

```bash
curl -X POST "http://localhost:3050/api/v1/hedging/auto-collar/NVDA" \
  -H "Content-Type: application/json" \
  -H "x-database-selection: mongodb" \
  -d '{"sharesCount":100,"expirationDate":"2027-01-15"}'
```

### `POST /hedging/protective-put`

Estructura un Protective Put manual.

**Body**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `symbol` | string | sí | `"AAPL"` |
| `spotPrice` | number | no (se busca en BD) | `338.95` |
| `sharesCount` | integer | no (default `100`) | `100` |
| `putStrike` | number | sí | `310` |
| `putPremium` | number | sí | `2.03` |
| `expirationDate` | string | no (+90 días) | `"2027-01-15"` |
| `volatility` | number | no (default `0.22`) | `0.225` |
| `portfolioId` | string | no | `"PORT-01"` |
| `companyName` | string | no | `"Apple Inc."` |

```bash
curl -X POST http://localhost:3050/api/v1/hedging/protective-put \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "spotPrice": 338.95,
    "sharesCount": 100,
    "putStrike": 310,
    "putPremium": 2.03,
    "expirationDate": "2027-01-15",
    "volatility": 0.225
  }'
```

### `POST /hedging/collar-spread`

Estructura un Collar manual (Put + Call).

**Body**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `symbol` | string | sí | `"AAPL"` |
| `spotPrice` | number | no (se busca en BD) | `338.95` |
| `sharesCount` | integer | no (default `100`) | `100` |
| `putStrike` | number | sí (< spot) | `310` |
| `callStrike` | number | sí (> spot) | `360` |
| `putPremium` | number | no (default `6.5`) | `2.03` |
| `callPremium` | number | no (default `6.6`) | `2.51` |
| `expirationDate` | string | no (+90 días) | `"2027-01-15"` |
| `volatility` | number | no (default `0.15`) | `0.225` |

```bash
curl -X POST http://localhost:3050/api/v1/hedging/collar-spread \
  -H "Content-Type: application/json" \
  -H "x-database-selection: supabase" \
  -d '{
    "portfolioId": "PORT-ALPACA-01",
    "symbol": "AAPL",
    "spotPrice": 338.95,
    "sharesCount": 100,
    "putStrike": 310,
    "callStrike": 360,
    "putPremium": 2.03,
    "callPremium": 2.51,
    "expirationDate": "2027-01-15",
    "volatility": 0.225
  }'
```

> Valida `putStrike < spotPrice < callStrike`; si no, responde `400`.

### `POST /hedging/batch`

Inserta un lote de estrategias completas (documentos tal cual).

```bash
curl -X POST http://localhost:3050/api/v1/hedging/batch \
  -H "Content-Type: application/json" \
  -d '[
    {
      "portfolioId": "PORT-01",
      "strategyType": "PROTECTIVE_PUT",
      "underlying": { "symbol": "AAPL", "companyName": "Apple Inc.", "spotPriceAtEntry": 338.95, "sharesCount": 100 },
      "legs": [],
      "financialMetrics": { "netDebitCredit": 0, "breakevenPrice": 338.95, "floorProtectionPrice": 0, "maxLossTotalUSD": 0, "netDelta": 1 }
    }
  ]'
```

### `GET /hedging/:id`

Detalle de una estrategia. Acepta `_id` o `portfolioId` (Mongo).

```bash
curl http://localhost:3050/api/v1/hedging/STRAT-COLLAR-AAPL-f5ba
```

### `PUT /hedging/:id/status`

**Body:** `{ "status": "CLOSED" }` (`ACTIVE`, `CLOSED`, `EXPIRED`).

```bash
curl -X PUT http://localhost:3050/api/v1/hedging/STRAT-COLLAR-AAPL-f5ba/status \
  -H "Content-Type: application/json" \
  -d '{"status":"CLOSED"}'
```

### `DELETE /hedging/:id`

Borrado lógico (`deletedAt` + `status: CLOSED`).

```bash
curl -X DELETE http://localhost:3050/api/v1/hedging/STRAT-COLLAR-AAPL-f5ba
```

### `GET /hedging/:id/underlying`

Subdocumento del activo subyacente.

```bash
curl http://localhost:3050/api/v1/hedging/STRAT-COLLAR-AAPL-f5ba/underlying
```

### `PUT /hedging/:id/underlying`

Actualización parcial del subdocumento.

```bash
curl -X PUT http://localhost:3050/api/v1/hedging/STRAT-COLLAR-AAPL-f5ba/underlying \
  -H "Content-Type: application/json" \
  -d '{"spotPriceAtEntry": 342.10, "sharesCount": 150}'
```

### `GET /hedging/:id/legs`

Lista las patas.

```bash
curl http://localhost:3050/api/v1/hedging/STRAT-COLLAR-AAPL-f5ba/legs
```

### `GET /hedging/:id/legs/:legId`

Una pata por `legId`.

```bash
curl http://localhost:3050/api/v1/hedging/STRAT-COLLAR-AAPL-f5ba/legs/LEG-AAPL-PUT
```

### `POST /hedging/:id/legs`

Agrega una pata. Requiere al menos `assetType`.

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `legRole` | string | sí | `HEDGE_FLOOR` |
| `assetType` | string | sí | `OPTION` \| `EQUITY` |
| `quantity` | integer | sí | `1` |
| `entryPrice` | number | sí | `2.10` |
| `optionType` | string | no | `PUT` \| `CALL` |
| `strike` | number | no | `310` |
| `expirationDate` | string | no | `"2027-01-15"` |
| `contractSymbol` | string | no | `"AAPL270115P00310000"` |
| `legId` | string | no (se genera) | `"LEG-AAPL-PUT-2"` |

```bash
curl -X POST http://localhost:3050/api/v1/hedging/STRAT-COLLAR-AAPL-f5ba/legs \
  -H "Content-Type: application/json" \
  -d '{
    "legRole": "HEDGE_FLOOR",
    "assetType": "OPTION",
    "optionType": "PUT",
    "strike": 310,
    "expirationDate": "2027-01-15",
    "quantity": 1,
    "entryPrice": 2.10
  }'
```

### `POST /hedging/:id/legs/batch`

Acepta `{ "legs": [...] }` o un arreglo directo.

```bash
curl -X POST http://localhost:3050/api/v1/hedging/STRAT-COLLAR-AAPL-f5ba/legs/batch \
  -H "Content-Type: application/json" \
  -d '{
    "legs": [
      { "legRole": "HEDGE_FLOOR", "assetType": "OPTION", "optionType": "PUT", "strike": 310, "quantity": 1, "entryPrice": 2.10 },
      { "legRole": "FINANCE_CEILING", "assetType": "OPTION", "optionType": "CALL", "strike": 360, "quantity": 1, "entryPrice": 2.51 }
    ]
  }'
```

### `PUT /hedging/:id/legs/batch`

Actualiza varias patas. Body: arreglo con `legId`.

```bash
curl -X PUT http://localhost:3050/api/v1/hedging/STRAT-COLLAR-AAPL-f5ba/legs/batch \
  -H "Content-Type: application/json" \
  -d '[
    { "legId": "LEG-AAPL-PUT", "strike": 315, "entryPrice": 2.40 },
    { "legId": "LEG-AAPL-CALL", "strike": 365, "entryPrice": 2.60 }
  ]'
```

### `PUT /hedging/:id/legs/:legId`

Actualiza una pata.

```bash
curl -X PUT http://localhost:3050/api/v1/hedging/STRAT-COLLAR-AAPL-f5ba/legs/LEG-AAPL-PUT \
  -H "Content-Type: application/json" \
  -d '{"strike": 315, "entryPrice": 2.40}'
```

### `DELETE /hedging/:id/legs/batch`

**Body:** `{ "legIds": ["LEG-AAPL-PUT", "LEG-AAPL-CALL"] }`.

```bash
curl -X DELETE http://localhost:3050/api/v1/hedging/STRAT-COLLAR-AAPL-f5ba/legs/batch \
  -H "Content-Type: application/json" \
  -d '{"legIds":["LEG-AAPL-PUT"]}'
```

### `DELETE /hedging/:id/legs/:legId`

Elimina una pata.

```bash
curl -X DELETE http://localhost:3050/api/v1/hedging/STRAT-COLLAR-AAPL-f5ba/legs/LEG-AAPL-PUT
```

### `GET /hedging/:id/financial-metrics`

Métricas financieras de la estrategia.

```bash
curl http://localhost:3050/api/v1/hedging/STRAT-COLLAR-AAPL-f5ba/financial-metrics
```

### `PUT /hedging/:id/financial-metrics/recalculate`

Recalcula con un spot actual opcional.

```bash
curl -X PUT http://localhost:3050/api/v1/hedging/STRAT-COLLAR-AAPL-f5ba/financial-metrics/recalculate \
  -H "Content-Type: application/json" \
  -d '{"currentSpotPrice": 345.00}'
```

### `GET /hedging/:id/payoff-matrix`

Matriz de P&L para la PWA.

| Query | Default | Ejemplo |
|---|---|---|
| `steps` | `25` | `40` |
| `rangePct` | `0.25` | `0.30` |

```bash
curl "http://localhost:3050/api/v1/hedging/STRAT-COLLAR-AAPL-f5ba/payoff-matrix?steps=30&rangePct=0.30"
```

---

## 7. Strategies

Segunda fachada sobre el mismo repositorio de estrategias. Añade cálculo de griegas agregadas, simulación F0/F2 y CRUD de patas con `reorder` y `ratio`.

### `GET /strategies`

Filtros: `status`, `portfolioId`, `strategyType`.

```bash
curl "http://localhost:3050/api/v1/strategies?status=ACTIVE&portfolioId=PORT-01"
```

### `GET /strategies/:id`

```bash
curl http://localhost:3050/api/v1/strategies/STRAT-COLLAR-AAPL-f5ba
```

### `POST /strategies`

Crea una estrategia base.

**Body**

| Campo | Tipo | Requerido |
|---|---|---|
| `portfolioId` | string | sí |
| `strategyType` | string | sí (`PROTECTIVE_PUT`, `COLLAR`, `COLLAR_SPREAD`) |
| `underlying.symbol` | string | sí |
| `underlying.spotPriceAtEntry` | number | sí |
| `underlying.companyName` | string | no |
| `underlying.sharesCount` | integer | no (default `100`) |
| `legs` | array | no |
| `financialMetrics` | object | no |

```bash
curl -X POST http://localhost:3050/api/v1/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "portfolioId": "PORT-01",
    "strategyType": "PROTECTIVE_PUT",
    "underlying": {
      "symbol": "AAPL",
      "companyName": "Apple Inc.",
      "spotPriceAtEntry": 338.95,
      "sharesCount": 100
    },
    "legs": []
  }'
```

### `POST /strategies/collar-spread`

Mismo contrato que `POST /hedging/collar-spread`.

```bash
curl -X POST http://localhost:3050/api/v1/strategies/collar-spread \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","spotPrice":338.95,"sharesCount":100,"putStrike":310,"callStrike":360,"putPremium":2.03,"callPremium":2.51,"expirationDate":"2027-01-15"}'
```

### `PUT /strategies/:id`

Actualización parcial libre (campos del esquema).

```bash
curl -X PUT http://localhost:3050/api/v1/strategies/STRAT-COLLAR-AAPL-f5ba \
  -H "Content-Type: application/json" \
  -d '{"status":"ACTIVE"}'
```

### `PATCH /strategies/:id/status` y `PUT /strategies/:id/status`

**Body:** `{ "status": "CLOSED" }`.

```bash
curl -X PATCH http://localhost:3050/api/v1/strategies/STRAT-COLLAR-AAPL-f5ba/status \
  -H "Content-Type: application/json" \
  -d '{"status":"CLOSED"}'
```

### `POST /strategies/:id/sync-spot`

Sincroniza `spotPriceAtEntry` con la cotización viva del broker.

```bash
curl -X POST http://localhost:3050/api/v1/strategies/STRAT-COLLAR-AAPL-f5ba/sync-spot
```

### `DELETE /strategies/:id`

```bash
curl -X DELETE http://localhost:3050/api/v1/strategies/STRAT-COLLAR-AAPL-f5ba
```

### `GET /strategies/:id/financial-metrics`

```bash
curl http://localhost:3050/api/v1/strategies/STRAT-COLLAR-AAPL-f5ba/financial-metrics
```

### `POST /strategies/:id/calculate-greeks`

Calcula Delta, Gamma, Vega, Theta y Rho agregadas.

```bash
curl -X POST http://localhost:3050/api/v1/strategies/STRAT-COLLAR-AAPL-f5ba/calculate-greeks
```

### `POST /strategies/:id/simulate-f0-f2`

Simula el P&L con un precio futuro F2.

| Campo | Tipo | Ejemplo |
|---|---|---|
| `futureSpotF2` | number | `370` |
| `daysElapsed` | integer | `30` |

```bash
curl -X POST http://localhost:3050/api/v1/strategies/STRAT-COLLAR-AAPL-f5ba/simulate-f0-f2 \
  -H "Content-Type: application/json" \
  -d '{"futureSpotF2": 370, "daysElapsed": 30}'
```

### Patas bajo `/strategies/:id/legs`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/strategies/:id/legs` | Lista patas |
| `POST` | `/strategies/:id/legs` | Agrega una pata (requiere `assetType`) |
| `POST` | `/strategies/:id/legs/batch` | Agrega lote (`{legs:[...]}` o arreglo) |
| `PUT` | `/strategies/:id/legs/reorder` | Reordena (`{orderedLegIds:[...]}` o arreglo) |
| `GET` | `/strategies/:id/legs/:legId` | Una pata |
| `PUT` | `/strategies/:id/legs/:legId` | Actualiza pata |
| `PATCH` | `/strategies/:id/legs/:legId/ratio` | Ajusta `ratio` y `quantity` |
| `DELETE` | `/strategies/:id/legs/:legId` | Elimina pata |

```bash
# Reordenar
curl -X PUT http://localhost:3050/api/v1/strategies/STRAT-COLLAR-AAPL-f5ba/legs/reorder \
  -H "Content-Type: application/json" \
  -d '{"orderedLegIds":["LEG-AAPL-CALL","LEG-AAPL-PUT","LEG-AAPL-STOCK"]}'

# Ajustar ratio
curl -X PATCH http://localhost:3050/api/v1/strategies/STRAT-COLLAR-AAPL-f5ba/legs/LEG-AAPL-PUT/ratio \
  -H "Content-Type: application/json" \
  -d '{"ratio": 1.5, "quantity": 2}'
```

---

## 8. Analytics

### `POST /analytics/implied-volatility`

Volatilidad implícita por Newton-Raphson.

| Campo | Tipo | Requerido |
|---|---|---|
| `marketPrice` | number | sí |
| `spotPrice` | number | sí |
| `strikePrice` | number | sí |
| `timeToExpirationYears` | number | sí |
| `riskFreeRate` | number | no (default `0.045`) |
| `optionType` | string | no (default `PUT`) |

```bash
curl -X POST http://localhost:3050/api/v1/analytics/implied-volatility \
  -H "Content-Type: application/json" \
  -d '{"marketPrice":3.5,"spotPrice":100,"strikePrice":105,"timeToExpirationYears":0.25,"optionType":"PUT"}'
```

### `GET /analytics/payoff-matrix/:id`

Igual que `/hedging/:id/payoff-matrix`.

```bash
curl "http://localhost:3050/api/v1/analytics/payoff-matrix/STRAT-COLLAR-AAPL-f5ba?steps=25&rangePct=0.25"
```

---

## 9. Quant

### `POST /quant/black-scholes`

Valuación analítica y 5 griegas.

| Campo | Tipo | Requerido | Default |
|---|---|---|---|
| `spotPrice` | number | sí | — |
| `strikePrice` | number | sí | — |
| `timeToExpirationYears` | number | sí | — |
| `riskFreeRate` | number | no | `0.045` |
| `volatility` | number | no | `0.2` |
| `optionType` | string | no | `PUT` |

```bash
curl -X POST http://localhost:3050/api/v1/quant/black-scholes \
  -H "Content-Type: application/json" \
  -d '{"spotPrice":100,"strikePrice":105,"timeToExpirationYears":0.25,"volatility":0.2,"optionType":"PUT"}'
```

### `POST /quant/implied-volatility`

Mismo contrato que `/analytics/implied-volatility`.

```bash
curl -X POST http://localhost:3050/api/v1/quant/implied-volatility \
  -H "Content-Type: application/json" \
  -d '{"marketPrice":3.5,"spotPrice":100,"strikePrice":105,"timeToExpirationYears":0.25}'
```

---

## 10. Broker

Integración con Alpaca Paper Trading. Si Alpaca no está configurado, responde con datos simulados.

### `GET /broker/account`

Cuenta, cash y poder de compra.

```bash
curl http://localhost:3050/api/v1/broker/account
```

### `GET /broker/quote/:symbol`

Cotización bid/ask/último precio.

```bash
curl http://localhost:3050/api/v1/broker/quote/AAPL
```

```json
{
  "symbol": "AAPL",
  "companyName": "Apple Inc.",
  "lastPrice": 338.95,
  "bid": 338.90,
  "ask": 339.00,
  "volatility": 0.225,
  "bidSize": 40,
  "askSize": 40,
  "source": "Alpaca Market Data v2 (Paper Live Feed - Snapshot)"
}
```

### `GET /broker/options-chain/:symbol`

Cadena de opciones (puts y calls).

| Query | Default | Ejemplo |
|---|---|---|
| `expiration` | fecha interna | `2027-01-15` |

```bash
curl "http://localhost:3050/api/v1/broker/options-chain/AAPL?expiration=2027-01-15"
```

### `GET /broker/positions`

Posiciones abiertas.

```bash
curl http://localhost:3050/api/v1/broker/positions
```

### `GET /broker/orders`

Historial de órdenes.

| Query | Default | Ejemplo |
|---|---|---|
| `status` | `all` | `open`, `closed`, `all` |

```bash
curl "http://localhost:3050/api/v1/broker/orders?status=all"
```

### `POST /broker/orders`

Emite una orden (paper trading real si Alpaca está configurado).

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `symbol` | string | sí | `"AAPL"` o `"AAPL270115P00310000"` |
| `qty` | number | no (default `1`) | `100` |
| `side` | string | no (default `buy`) | `buy`, `sell` |
| `type` | string | no (default `limit`) | `market`, `limit` |
| `limitPrice` / `limit_price` | number | si `type=limit` | `345.00` |
| `timeInForce` / `time_in_force` | string | no (default `day`) | `day`, `gtc` |

```bash
# Acciones
curl -X POST http://localhost:3050/api/v1/broker/orders \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","qty":100,"side":"buy","type":"limit","limitPrice":345.00,"timeInForce":"day"}'

# Opción (simbología OCC)
curl -X POST http://localhost:3050/api/v1/broker/orders \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL270115P00310000","qty":1,"side":"buy","type":"limit","limitPrice":2.15,"timeInForce":"day"}'
```

> Los errores de Alpaca se devuelven como `400` con el mensaje del broker.

### `DELETE /broker/orders/:id`

Cancela una orden existente.

```bash
curl -X DELETE http://localhost:3050/api/v1/broker/orders/<ORDER_ID>
```

### `POST /broker/sync-underlying/:symbol`

Sincroniza el spot del subyacente en la BD con el broker.

```bash
curl -X POST http://localhost:3050/api/v1/broker/sync-underlying/MSFT \
  -H "x-database-selection: mongodb"
```

---

## 11. Market

Alias de solo lectura para cotizaciones y cadenas.

### `GET /market/quote/:symbol`

```bash
curl http://localhost:3050/api/v1/market/quote/NVDA
```

### `GET /market/options-chain/:symbol`

```bash
curl "http://localhost:3050/api/v1/market/options-chain/NVDA?expiration=2027-01-15"
```

---

## 12. Secuencia de práctica recomendada

### Fase 1 — Solo lectura (no modifica nada)

```bash
curl http://localhost:3050/api/v1/health
curl http://localhost:3050/api/v1/broker/quote/AAPL
curl "http://localhost:3050/api/v1/broker/options-chain/AAPL?expiration=2027-01-15"
curl "http://localhost:3050/api/v1/hedging/recommend-option/AAPL?type=PUT&moneyness=OTM&expiration=2027-01-15"
curl "http://localhost:3050/api/v1/hedging/recommend-option/AAPL?type=CALL&moneyness=OTM&expiration=2027-01-15"
curl "http://localhost:3050/api/v1/hedging/recommend-collar/AAPL?expiration=2027-01-15"
curl http://localhost:3050/api/v1/hedging
curl http://localhost:3050/api/v1/underlyings
curl http://localhost:3050/api/v1/broker/account
```

### Fase 2 — Persistencia dual

```bash
# MongoDB
curl -X POST http://localhost:3050/api/v1/hedging/collar-spread \
  -H "Content-Type: application/json" -H "x-database-selection: mongodb" \
  -d '{"symbol":"AAPL","spotPrice":338.95,"sharesCount":100,"putStrike":310,"callStrike":360,"putPremium":2.03,"callPremium":2.51,"expirationDate":"2027-01-15"}'

# Supabase
curl -X POST http://localhost:3050/api/v1/hedging/collar-spread \
  -H "Content-Type: application/json" -H "x-database-selection: supabase" \
  -d '{"symbol":"AAPL","spotPrice":338.95,"sharesCount":100,"putStrike":310,"callStrike":360,"putPremium":2.03,"callPremium":2.51,"expirationDate":"2027-01-15"}'
```

### Fase 3 — Órdenes paper

```bash
# 1. Crear orden
curl -X POST http://localhost:3050/api/v1/broker/orders \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","qty":1,"side":"buy","type":"market","timeInForce":"day"}'

# 2. Consultar órdenes
curl "http://localhost:3050/api/v1/broker/orders?status=all"

# 3. Cancelar (usa el id devuelto)
curl -X DELETE http://localhost:3050/api/v1/broker/orders/<ORDER_ID>
```

---

## 13. Notas y limitaciones actuales

1. **Webull no está implementado.** `x-broker-selection: WEBULL` y `?broker=WEBULL` se ignoran; todo se resuelve con Alpaca o el fallback simulado.
2. **`executeOrders` no se usa.** `POST /hedging/auto-collar` solo estructura y persiste; no emite órdenes.
3. **`/api/v1/prod-serv`** (request de U1 en Postman) no existe en este backend → `404`.
4. **Autenticación de v1:** `POST /auth/login` acepta cualquier usuario/contraseña no vacíos. El JWT solo aporta identidad y `dbTarget`.
5. **Fechas de expiración:** deben ser futuras. Si pasas una fecha pasada, responde `400`.
6. **`recommend-option` y `recommend-collar` no persisten.** Para guardar usa `collar-spread`, `protective-put` o `auto-collar`.
7. **Borrado lógico:** `DELETE` en estrategias y subyacentes marca `deletedAt`; no elimina el documento físicamente.
8. **MongoDB Atlas:** si el resolver DNS local falla con SRV, el backend reintenta con `1.1.1.1`/`8.8.8.8` (configurable con `DNS_SERVERS`).
9. **`/health`** devuelve `DEGRADED` si MongoDB no está conectado.
