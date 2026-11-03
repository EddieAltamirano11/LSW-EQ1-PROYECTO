# Flujo Integral de Ejecución: Calibración Automática de Collar con Webull OpenAPI

## 1. Visión General de la Operación

Este documento detalla de principio a fin el ciclo de vida de una petición al endpoint de calibración automática de coberturas financieras (`POST /api/v1/hedging/auto-collar`) cuando se procesa mediante **Webull OpenAPI**, interactuando con los servidores sandbox de Webull y la cuenta de simulación **`DEV4Q8EB`** visible en la **Webull Desktop App**.

### Objetivo Cuantitativo del Endpoint
Estructurar y optimizar matemáticamente un **Zero-Cost Collar** garantizando:
* **Precio Spot Subyacente en Vivo**: $S_0$ obtenido directamente del libro de órdenes L1 de Webull.
* **Pata 1 (Piso de Protección)**: Opción de venta fuera del dinero (**Long Put OTM**, $K_{put} < S_0$).
* **Pata 2 (Techo de Financiamiento)**: Opción de compra fuera del dinero (**Short Call OTM**, $K_{call} > S_0$).
* **Condición Zero-Cost**: El ingreso obtenido por la venta de la Call financia con exactitud el costo de compra de la Put ($Prima_{call} \approx Prima_{put}$).

---

## 2. Diagrama de Secuencia del Flujo (Webull OpenAPI)

```
[Cliente HTTP / Postman / Scalar Docs]
         │
         │  1. POST /api/v1/hedging/auto-collar
         │     Headers: x-broker-selection: WEBULL, x-database-selection: mongodb
         │     Body: { "symbol": "AAPL", "sharesCount": 100 }
         ▼
[app.js: Pipeline de Middlewares]
         │
         ├──> authMiddleware (Valida JWT o modo desarrollo)
         ├──> databaseContextMiddleware (req.dbTarget = 'mongodb')
         └──> brokerContextMiddleware (req.broker = 'WEBULL')
         ▼
[hedging.controller.js: autoCalibrateCollar]
         │
         │  2. Extrae parámetros de la solicitud y delega:
         │     HedgingService.autoCalibrateAndCreateCollar(params, 'mongodb')
         ▼
[hedging.service.js]
         │
         │  3. Solicita cotización spot del activo a Webull
         │     getBrokerQuote('AAPL', 'WEBULL')
         ▼
[broker.service.js (Strategy Dispatcher)]
         │
         │  4. Detecta targetBroker === 'WEBULL'
         │     Delega a WebullService.getWebullQuote('AAPL')
         ▼
[webull.service.js: Puente IPC]
         │
         │  5. Ejecuta subproceso Python:
         │     python scripts/webull_desktop_bridge.py quote --symbol AAPL
         ▼
[webull_desktop_bridge.py (Python SDK)]
         │
         │  6. Inicializa ApiClient con WEBULL_APP_KEY y WEBULL_APP_SECRET
         │     Genera firma HMAC-SHA256 (x-signature, x-timestamp, x-signature-nonce)
         │     Llama a dc.market_data.get_snapshot('AAPL', Category.US_STOCK.name)
         ▼
[Webull OpenAPI Sandbox Gateway (api.sandbox.webull.com)]
         │
         │  7. Valida firma criptográfica y devuelve libro L1 oficial en tiempo real:
         │     { price: "342.96", bid: "344.50", ask: "345.05", pe_ratio: "39.31" }
         ▼
[webull.service.js]
         │
         │  8. Recibe JSON parseado: S = $342.96 USD
         │     Solicita cadena de opciones: getWebullOptionsChain('AAPL', '2026-10-16')
         ▼
[hedging.service.js: Motor Cuantitativo]
         │
         │  9. Algoritmo de Optimización:
         │     - Filtra Puts OTM (K < 342.96) y Calls OTM (K > 342.96)
         │     - Evalúa pares y minimiza diferencial de primas (|Call - Put| -> 0)
         │     - Selecciona par óptimo: Put $325.00 vs Call $360.00
         │     - Valúa las 5 Griegas analíticas (Black-Scholes analítico de quant.service)
         │     - Calcula Floor ($325.00), Cap ($360.00), Breakeven y Payoff
         ▼
[hedging.mongo.repo.js]
         │
         │  10. Persiste estrategia completa con broker: 'WEBULL' en MongoDB Atlas
         │      Colección: hedgingstrategies
         ▼
[Cliente HTTP / Frontend]
            11. Recibe respuesta HTTP 201 Created con el Collar estructurado
```

---

## 3. Desglose Técnico Paso a Paso

### Paso 1: Recepción e Inyección de Contexto
El servidor Express (`src/app.js`) recibe la petición. En la tubería de middlewares:
1. `brokerContextMiddleware`: Inspecciona el header `x-broker-selection: WEBULL` (o query param `?broker=WEBULL` o fallback de entorno `DEFAULT_BROKER=WEBULL`).
   - Asigna `req.broker = 'WEBULL'`.
   - Inyecta la cabecera de respuesta HTTP `X-Active-Broker: WEBULL` para trazabilidad de observabilidad.
2. `databaseContextMiddleware`: Resuelve la base de datos destino (`mongodb` o `supabase`) e inyecta `req.dbTarget`.

### Paso 2: Despacho en el Controlador
En `src/api/v1/controllers/hedging.controller.js`:
* La función `autoCalibrateCollar` lee el símbolo (`req.params.symbol` o `req.body.symbol`), la cantidad de acciones (`sharesCount`), la fecha de expiración y el broker (`req.broker`).
* Transfiere los parámetros a `HedgingService.autoCalibrateAndCreateCollar(params, req.dbTarget)`.

### Paso 3: Consulta de Cotización en Tiempo Real mediante el SDK Oficial
En `src/api/v1/services/broker.service.js`:
* `getBrokerQuote(symbol, 'WEBULL')` despacha la llamada hacia `WebullService.getWebullQuote(symbol)`.
* `webull.service.js` ejecuta de forma síncrona mediante subproceso seguro el puente `scripts/webull_desktop_bridge.py quote --symbol AAPL`.

### Paso 4: Criptografía y Firma HMAC-SHA256 en Webull
Dentro de `scripts/webull_desktop_bridge.py`:
1. Se cargan las credenciales oficiales de Webull OpenAPI:
   * `WEBULL_APP_KEY = us.d099728c9dc63c32a77ea49fc73ec4b5`
   * `WEBULL_APP_SECRET = 961df980a66ff97bdd5bfe9de3fd3a04`
   * `WEBULL_ACCOUNT_ID = DEV4Q8EB`
2. `ApiClient` del SDK oficial `webull-openapi-python-sdk` ensambla la firma para cada petición:
   * Nonce criptográfico aleatorio (`x-signature-nonce`).
   * Timestamp UTC estricto en formato ISO 8601 (`x-timestamp`).
   * Cifrado HMAC-SHA256 sobre la URI canonicalizada.
3. `DataClient.market_data.get_snapshot('AAPL', Category.US_STOCK.name)` consulta a `api.sandbox.webull.com`.
4. El servidor de Webull responde con código `200 OK` y el snapshot oficial:
   * Precio de cierre/último cruce: \$342.96 USD.
   * Bid: \$344.50 USD / Ask: \$345.05 USD.
   * Múltiplos financieros (P/E Ratio, P/B Ratio, Volumen).

### Paso 5: Generación y Selección de la Cadena de Opciones
* `getWebullOptionsChain()` toma el precio spot oficial de Webull y consulta los contratos negociables asociados a la cuenta `DEV4Q8EB`.
* Se estructuran los contratos candidatos de compra (Calls) y venta (Puts).

### Paso 6: Optimización Matemática Zero-Cost en `hedging.service.js`
El algoritmo realiza los siguientes cálculos cuantitativos:
1. **Filtro de Strikes OTM**:
   * Puts candidatas: $K_{put} < \$342.96$ (por ejemplo, strike \$325.00).
   * Calls candidatas: $K_{call} > \$342.96$ (por ejemplo, strike \$360.00).
2. **Minimización de Flujo Neto**:
   * Evalúa la matriz de combinaciones buscando minimizar:
     $$\Delta Prima = |Prima_{call}(K_{call}) - Prima_{put}(K_{put})| \approx 0$$
3. **Cálculo de Sensibilidades Griegas (F0)**:
   * Invoca `calculateBlackScholes()` de `src/api/v1/services/quant.service.js`:
     * $\Delta$ (Delta): Sensibilidad al precio spot.
     * $\Gamma$ (Gamma): Curvatura de la posición.
     * $\Theta$ (Theta): Decaimiento temporal.
     * $\mathcal{V}$ (Vega): Sensibilidad a la volatilidad implícita.
     * $\rho$ (Rho): Sensibilidad a la tasa libre de riesgo.
4. **Métricas de Rendimiento y Riesgo**:
   * **Floor Price**: \$325.00 (protección del 94.76% del valor).
   * **Ceiling Price**: \$360.00 (techo de ganancia máxima de 104.97%).
   * **Pérdida Máxima**: $\$342.96 - \$325.00 + CostoNeto$.

### Paso 7: Persistencia y Vinculación con la Cartera de Webull
* Se guarda el documento en MongoDB Atlas o Supabase con la etiqueta `broker: 'WEBULL'`.
* El ID de cuenta asociado queda registrado como `DEV4Q8EB` (OpenAPI ID: `GBG647DN3VL57GSDVGA47NCG18`).
* El cliente recibe la confirmación con código `HTTP 201 Created`.

---

## 4. Ejemplo de Petición y Respuesta Real

### Petición HTTP (`curl`):
```bash
curl -X POST http://localhost:3050/api/v1/hedging/auto-collar \
  -H "Content-Type: application/json" \
  -H "x-broker-selection: WEBULL" \
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
  "broker": "WEBULL",
  "data": {
    "strategyType": "COLLAR_SPREAD",
    "status": "ACTIVE",
    "broker": "WEBULL",
    "underlying": {
      "symbol": "AAPL",
      "companyName": "Apple Inc.",
      "spotPrice": 342.96,
      "sharesCount": 100,
      "source": "Webull Open Platform (Live Market Data Feed)"
    },
    "legs": [
      {
        "legType": "PROTECTIVE_PUT",
        "optionType": "PUT",
        "action": "BUY",
        "strikePrice": 325.00,
        "premium": 3.48,
        "contractsCount": 1,
        "greeks": {
          "delta": -0.2862,
          "gamma": 0.0141,
          "theta": -0.0415,
          "vega": 0.1822
        }
      },
      {
        "legType": "COVERED_CALL",
        "optionType": "CALL",
        "action": "SELL",
        "strikePrice": 360.00,
        "premium": 3.52,
        "contractsCount": 1,
        "greeks": {
          "delta": 0.2905,
          "gamma": 0.0139,
          "theta": -0.0402,
          "vega": 0.1802
        }
      }
    ],
    "financialMetrics": {
      "netCost": -4.00,
      "isZeroCost": true,
      "floorPrice": 325.00,
      "ceilingPrice": 360.00,
      "maxLoss": 1796.00,
      "maxProfit": 1704.00,
      "protectionPercentage": 94.76,
      "upsidePotentialPercentage": 104.97
    }
  }
}
```

---

## 5. Emisión y Ejecución de Órdenes en la App de Escritorio de Webull

Existen dos modalidades para reflejar la estrategia Collar en la aplicación de escritorio de Webull:

### Modalidad A: Auto-Ejecución Integrada (`executeOrders: true`)
Al invocar `POST /api/v1/hedging/auto-collar` con el flag `"executeOrders": true`, el sistema calibra la combinación óptima, persiste la estrategia en MongoDB/Supabase y **automáticamente despacha ambas órdenes de opciones** a Webull OpenAPI en una sola llamada:

```bash
curl -X POST http://localhost:3050/api/v1/hedging/auto-collar \
  -H "Content-Type: application/json" \
  -H "x-broker-selection: WEBULL" \
  -H "x-database-selection: mongodb" \
  -d '{
    "symbol": "NVDA",
    "sharesCount": 100,
    "expirationDate": "2026-10-16",
    "executeOrders": true
  }'
```

**Flujo interno de auto-ejecución:**
1. `hedging.service.js` detecta `executeOrders === true`.
2. Se construyen los payloads para ambas patas:
   - **Put Protector:** Compra (`BUY`) de 1 contrato Put OTM al strike óptimo.
   - **Call Financiador:** Venta (`SELL`) de 1 contrato Call OTM al strike óptimo.
3. Se invoca `createBrokerOrder()` para cada una, disparando `scripts/webull_desktop_bridge.py place_option`.
4. Webull OpenAPI devuelve los identificadores de orden (ej. `CNJOCMJMR5QM5F4LK3Q6JPOCS8`, `D0GU1BK4940AFCHSR4KC15I4HA`).
5. Se actualiza la base de datos inyectando los `brokerOrderId` en las patas de la estrategia.
6. La respuesta HTTP incluye el bloque `brokerExecution` confirmando el envío.
7. Las órdenes aparecen de inmediato en la app **Webull Desktop** dentro de la pestaña **`Orders -> Open / Working`** de tu cuenta **`DEV4Q8EB`**.

---

### Modalidad B: Emisión Desacoplada (Manual vía `/broker/orders`)
Si se ejecuta `auto-collar` con `executeOrders: false` (o por defecto), la estrategia queda guardada como borrador/propuesta en la base de datos sin comprometer capital. Posteriormente, el usuario puede enviar cada pata al mercado de forma explícita:

```bash
curl -X POST http://localhost:3050/api/v1/broker/orders \
  -H "Content-Type: application/json" \
  -d '{
    "broker": "WEBULL",
    "symbol": "NVDA",
    "instrumentType": "OPTION",
    "optionType": "PUT",
    "strikePrice": 120,
    "expirationDate": "2026-10-16",
    "qty": 1,
    "side": "buy",
    "type": "limit",
    "limitPrice": 3.50
  }'
```

