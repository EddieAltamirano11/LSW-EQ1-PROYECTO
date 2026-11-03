# Flujo Integral de Ejecución: Calibración Automática de Collar con Alpaca Markets

## 1. Visión General de la Operación

Este documento describe con precisión milimétrica la trayectoria de ejecución que sigue el sistema desde que un cliente HTTP invoca el endpoint de calibración automática de coberturas financieras (`POST /api/v1/hedging/auto-collar`), pasando por la capa de middleware, el despachador de brokers, la comunicación directa con **Alpaca Markets Paper Trading API**, la resolución del algoritmo de optimización matemática de costo cero, hasta la persistencia y respuesta final.

### Objetivo Cuantitativo del Endpoint
Estructurar un **Zero-Cost Collar** sobre una posición accionaria existente:
* **Posición Larga en Acciones**: $S_0$ (obtenido en tiempo real desde Alpaca).
* **Pata 1 (Piso / Cobertura)**: Compra de una opción de venta fuera del dinero (**Long Put OTM**, $K_{put} < S_0$).
* **Pata 2 (Techo / Financiamiento)**: Venta de una opción de compra fuera del dinero (**Short Call OTM**, $K_{call} > S_0$).
* **Condición de Costo Cero**: $|Prima_{call} - Prima_{put}| \approx \$0.00$.

---

## 2. Diagrama de Secuencia del Flujo (Alpaca Markets)

```
[Cliente HTTP / Frontend]
         │
         │  1. POST /api/v1/hedging/auto-collar
         │     Headers: x-broker-selection: ALPACA, x-database-selection: mongodb
         │     Body: { "symbol": "AAPL", "sharesCount": 100 }
         ▼
[app.js: Pipeline de Middlewares]
         │
         ├──> authMiddleware (Valida sesión o modo desarrollo)
         ├──> databaseContextMiddleware (Inyecta req.dbTarget = 'mongodb')
         └──> brokerContextMiddleware (Inyecta req.broker = 'ALPACA')
         ▼
[hedging.controller.js: autoCalibrateCollar]
         │
         │  2. Extrae parámetros y delega:
         │     HedgingService.autoCalibrateAndCreateCollar(params, 'mongodb')
         ▼
[hedging.service.js]
         │
         │  3. Solicita cotización spot del activo
         │     getBrokerQuote('AAPL', 'ALPACA')
         ▼
[broker.service.js (Strategy Dispatcher)]
         │
         │  4. Enruta a alpacaDataClient
         │     GET https://data.alpaca.markets/v2/stocks/AAPL/snapshot?feed=iex
         │     Headers: APCA-API-KEY-ID, APCA-API-SECRET-KEY
         ▼
[Servidores de Alpaca Markets (Cloud)]
         │
         │  5. Devuelve snapshot bursátil en vivo
         │     { latestTrade: { p: 343.01 }, latestQuote: { bp: 342.95, ap: 343.05 } }
         ▼
[broker.service.js]
         │
         │  6. Normaliza spot: S = $343.01 USD
         │     Solicita cadena de opciones: getBrokerOptionsChain('AAPL', '2026-10-16', 'ALPACA')
         │     Calcula strikes candidatos y primas teóricas con Black-Scholes / feeds OCC
         ▼
[hedging.service.js: Motor Cuantitativo]
         │
         │  7. Algoritmo de Optimización:
         │     - Filtra Puts OTM (K < 343.01) y Calls OTM (K > 343.01)
         │     - Evalúa pares y minimiza diferencial de primas (|Call - Put| -> 0)
         │     - Selecciona par óptimo: Put $325.00 vs Call $360.00
         │     - Calcula 5 Griegas analíticas (Delta, Gamma, Theta, Vega, Rho)
         │     - Determina Floor (94.75%), Cap (104.95%) y Net Premium Flow
         ▼
[hedging.mongo.repo.js]
         │
         │  8. Persiste documento con broker: 'ALPACA' en MongoDB Atlas
         │     Colección: hedgingstrategies
         ▼
[Cliente HTTP / Frontend]
            9. Recibe respuesta HTTP 201 Created con estrategia completa
```

---

## 3. Desglose Paso a Paso de la Ejecución

### Paso 1: Recepción e Inyección de Contexto
El servidor Express (`src/app.js`) recibe la petición. En la tubería de middlewares:
1. `brokerContextMiddleware`: Inspecciona el header `x-broker-selection: ALPACA` (o el query param `?broker=ALPACA` o el body). Asigna `req.broker = 'ALPACA'` y coloca la cabecera de respuesta `X-Active-Broker: ALPACA`.
2. `databaseContextMiddleware`: Determina si el almacenamiento será en MongoDB Atlas o Supabase (`req.dbTarget`).

### Paso 2: Despacho en el Controlador
En `src/api/v1/controllers/hedging.controller.js`:
* `autoCalibrateCollar` extrae `symbol`, `sharesCount`, `expirationDate`, `broker: req.broker` y llama a `HedgingService.autoCalibrateAndCreateCollar()`.

### Paso 3: Consulta del Precio Spot a Alpaca
En `src/api/v1/services/broker.service.js`:
* Al detectar `targetBroker === 'ALPACA'`, utiliza la instancia preconfigurada `alpacaDataClient` de Axios (`src/config/broker.config.js`).
* Realiza una llamada HTTP `GET` a:
  ```http
  GET /v2/stocks/AAPL/snapshot?feed=iex HTTP/1.1
  Host: data.alpaca.markets
  APCA-API-KEY-ID: PK4V5IGAOIZNH2XKBQYF6DW2XJ
  APCA-API-SECRET-KEY: 5tTmeXfiEFdMWRZkbkXCi53VsCKFvitrrgAmajxteUcB
  ```
* Extrae el precio de la última operación (`latestTrade.p`) o calcula el punto medio entre el bid y el ask (`(bp + ap) / 2`).

### Paso 4: Generación de la Cadena de Opciones
* Con el precio spot exacto de Alpaca (ej. \$343.01), `getBrokerOptionsChain()` genera la malla de contratos disponibles (Calls y Puts) con strikes equidistantes y calcula sus primas representativas basadas en la volatilidad implícita del activo y tiempo a vencimiento.

### Paso 5: Algoritmo de Calibración Matemática
El servicio `hedging.service.js` ejecuta el algoritmo de selección:
1. **Filtro de Candidatos**:
   * Puts protectores: Aquellos con precio de ejercicio inferior al spot ($K < \$343.01$).
   * Calls de financiamiento: Aquellos con precio de ejercicio superior al spot ($K > \$343.01$).
2. **Minimización de Costo Neto**:
   * Evalúa el producto cartesiano de combinaciones (Put, Call) y calcula la diferencia absoluta $|Prima_{call} - Prima_{put}|$.
   * Selecciona el par que minimiza el flujo de efectivo neto (idealmente \$0.00 por acción).
3. **Valuación de Griegas**:
   * Invoca `calculateBlackScholes()` de `quant.service.js` para derivar analíticamente $\Delta, \Gamma, \Theta, \mathcal{V}, \rho$ para cada pata y para la posición neta combinada.

### Paso 6: Persistencia y Respuesta al Cliente
* Se construye el objeto completo de la estrategia incluyendo subdocumentos `underlying`, `legs`, y `financialMetrics`.
* Se almacena en la base de datos seleccionada con el atributo de auditoría `broker: 'ALPACA'`.
* Se retorna el código de estado `HTTP 201 Created`.

---

## 4. Ejemplo de Petición y Respuesta Real

### Petición HTTP (`curl`):
```bash
curl -X POST http://localhost:3050/api/v1/hedging/auto-collar \
  -H "Content-Type: application/json" \
  -H "x-broker-selection: ALPACA" \
  -H "x-database-selection: mongodb" \
  -d '{
    "symbol": "AAPL",
    "sharesCount": 100,
    "expirationDate": "2026-10-16"
  }'
```

### Respuesta Devuelta (`HTTP 201 Created`):
```json
{
  "message": "Estrategia Zero-Cost Collar optimizada y registrada exitosamente.",
  "broker": "ALPACA",
  "data": {
    "strategyType": "COLLAR_SPREAD",
    "status": "ACTIVE",
    "broker": "ALPACA",
    "underlying": {
      "symbol": "AAPL",
      "companyName": "Apple Inc.",
      "spotPrice": 343.01,
      "sharesCount": 100,
      "source": "Alpaca Market Data v2 (Paper Live Feed - Snapshot)"
    },
    "legs": [
      {
        "legType": "PROTECTIVE_PUT",
        "optionType": "PUT",
        "action": "BUY",
        "strikePrice": 325.00,
        "premium": 3.45,
        "contractsCount": 1,
        "greeks": {
          "delta": -0.2854,
          "gamma": 0.0142,
          "theta": -0.0412,
          "vega": 0.1820
        }
      },
      {
        "legType": "COVERED_CALL",
        "optionType": "CALL",
        "action": "SELL",
        "strikePrice": 360.00,
        "premium": 3.50,
        "contractsCount": 1,
        "greeks": {
          "delta": 0.2910,
          "gamma": 0.0138,
          "theta": -0.0405,
          "vega": 0.1805
        }
      }
    ],
    "financialMetrics": {
      "netCost": -5.00,
      "isZeroCost": true,
      "floorPrice": 325.00,
      "ceilingPrice": 360.00,
      "maxLoss": 1801.00,
      "maxProfit": 1699.00,
      "protectionPercentage": 94.75,
      "upsidePotentialPercentage": 104.95
    }
  }
}
```

---

## 5. Modo de Auto-Ejecución en Broker (`executeOrders: true`)

Por defecto, `auto-collar` actúa como motor de calibración matemática y almacenamiento de portafolio sin comprometer capital. Si se envía el parámetro `"executeOrders": true` en el cuerpo JSON o como query param `?executeOrders=true`, el sistema ejecuta un flujo transaccional directo:

```
[hedging.service.js]
         │
         │  1. Calibra strikes óptimos y persiste en BD (MongoDB/Supabase)
         │  2. Detecta executeOrders: true
         ▼
[broker.service.js: createBrokerOrder]
         │
         ├──> Pata 1: POST https://paper-api.alpaca.markets/v2/orders
         │    Payload: { "symbol": "NVDA261016P00120000", "qty": 1, "side": "buy", "type": "limit", "limit_price": "2.50", "time_in_force": "day" }
         │    Resultado: status = 'accepted', orderId = 'cb5342d4-d8b5-48e7-895c-ce34697e0198'
         │
         └──> Pata 2: POST https://paper-api.alpaca.markets/v2/orders
              Payload: { "symbol": "NVDA261016C00135000", "qty": 1, "side": "sell", "type": "limit", "limit_price": "2.55", "time_in_force": "day" }
         ▼
[Actualización de BD]
         │
         └──> Inyecta brokerOrderId en cada pata (legs[i].brokerOrderId) en la BD.
         ▼
[Respuesta JSON al Cliente]
         Incluye objeto "brokerExecution" con IDs reales de las órdenes en Alpaca Paper Trading.
```

### Ejemplo de Petición con Auto-Ejecución:
```bash
curl -X POST http://localhost:3050/api/v1/hedging/auto-collar \
  -H "Content-Type: application/json" \
  -H "x-broker-selection: ALPACA" \
  -H "x-database-selection: supabase" \
  -d '{
    "symbol": "AAPL",
    "sharesCount": 100,
    "expirationDate": "2026-10-16",
    "executeOrders": true
  }'
```

