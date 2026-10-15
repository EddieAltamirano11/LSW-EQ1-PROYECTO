# Comparativa Arquitectónica: Unificación Multi-Broker Alpaca Markets & Webull OpenAPI

## 1. Resumen Ejecutivo

El sistema de gestión de coberturas financieras y trading algorítmico ha sido diseñado bajo una **arquitectura desacoplada y basada en el patrón Strategy**, permitiendo que todos los endpoints REST expuestos en el contrato OpenSpec (`v1.1.0`) operen de forma transparente e intercambiable entre **Alpaca Markets** y **Webull OpenAPI**.

El cliente o consumidor de la API puede conmutar entre ambos brokers en cualquier momento mediante:
1. **Header HTTP**: `x-broker-selection: WEBULL` o `x-broker-selection: ALPACA`.
2. **Query Param**: `?broker=WEBULL` o `?broker=ALPACA`.
3. **Cuerpo del JSON**: `{"broker": "WEBULL", ...}`.
4. **Fallback global**: Variable de entorno `DEFAULT_BROKER=WEBULL` en `.env`.

---

## 2. Matriz de Endpoints y Paridad Funcional

Todas las operaciones que originalmente funcionaban sobre Alpaca Markets ahora cuentan con paridad del 100% en Webull OpenAPI:

| Endpoint REST | Método | Función Bursátil | Comportamiento Alpaca | Comportamiento Webull |
| :--- | :---: | :--- | :--- | :--- |
| `/api/v1/broker/account` | `GET` | Balance, efectivo y poder de compra | Consulta `v2/account` en Alpaca Paper | Consulta `account_v2.get_account_balance` de la cuenta `DEV4Q8EB` |
| `/api/v1/broker/quote/:symbol` | `GET` | Cotización en tiempo real | `v2/stocks/:symbol/snapshot?feed=iex` | `dc.market_data.get_snapshot` (Feed oficial L1 en vivo) |
| `/api/v1/broker/options-chain/:symbol`| `GET` | Cadena de opciones vivas | Algoritmo proxy Black-Scholes sobre spot | `dc.instrument.get_option_contracts` + cotizaciones reales |
| `/api/v1/broker/positions` | `GET` | Posiciones abiertas en cartera | `v2/positions` | `tc.account_v2.get_account_position(DEV4Q8EB)` |
| `/api/v1/broker/orders` | `GET` | Historial y órdenes abiertas | `v2/orders?status=all` | `tc.order_v2.get_order_open` + `get_order_history` |
| `/api/v1/broker/orders` | `POST` | Compra/Venta de Acciones (`EQUITY`) | `POST v2/orders` (simple payload) | `tc.order_v2.place_order` (con validación `preview_order`) |
| `/api/v1/broker/orders` | `POST` | Compra/Venta de Opciones (`CALL`/`PUT`)| `POST v2/orders` con símbolo OCC | `tc.order_v2.place_option` con estructura multi-leg nativa |
| `/api/v1/broker/orders/:id` | `DELETE` | Cancelación de orden bursátil | `DELETE v2/orders/:id` | `tc.order_v2.cancel_order` / `cancel_option` |
| `/api/v1/broker/sync-underlying/:sym` | `POST` | Sincronizar spot en MongoDB / Supabase | Actualiza colección usando spot Alpaca | Actualiza colección usando spot Webull en tiempo real |
| `/api/v1/hedging/strategies/collar/auto-calibrate` | `POST` | Calibración Zero-Cost Collar | Optimiza primas usando quotes de Alpaca | Optimiza primas usando libro oficial de Webull |
| `/api/v1/hedging/recommendations/collar` | `GET` | Recomendación cuantitativa | Sugiere strikes con spot Alpaca | Sugiere strikes con spot Webull |

---

## 3. Diferencias Técnicas y de Implementación

A pesar de que el frontend y el consumidor REST reciben la misma interfaz JSON unificada, la implementación interna para hablar con cada broker difiere profundamente:

### A. Autenticación y Criptografía

* **Alpaca Markets (Estática y Ligera)**:
  * Utiliza un modelo estándar de API Keys estáticas enviadas mediante headers HTTP:
    ```http
    APCA-API-KEY-ID: PK4V5IGAOIZNH2XKBQYF6DW2XJ
    APCA-API-SECRET-KEY: 5tTmeXfiEFdMWRZkbkXCi...
    ```
  * No requiere firma criptográfica ni control de nonce temporal por petición.

* **Webull OpenAPI (Criptografía HMAC y Timestamps)**:
  * Emplea un protocolo de nivel institucional (v3) que exige firma digital dinámica por cada petición:
    1. Generación de `x-signature-nonce` (UUID único).
    2. Timestamp UTC en formato estricto ISO 8601 (`x-timestamp`).
    3. Construcción del string canónico para firmar (`METHOD + \n + PATH + \n + HEADERS + \n + BODY`).
    4. Cifrado HMAC-SHA256 con el `WEBULL_APP_SECRET`.
    5. Envío de cabecera `x-signature`.
  * Además, Webull implementa un WAF que bloquea conexiones no oficiales (`403 Illegal Client`), requiriendo el uso de su SDK oficial `webull-openapi-python-sdk` (v3.0.3) puenteado a Node.js.

---

### B. Modelo de Cuentas y Entidades

* **Alpaca Markets**:
  * Un único UUID de cuenta paper trading por par de llaves.
  * Una sola cartera para acciones y opciones.

* **Webull OpenAPI**:
  * Un único usuario (`1200184362`) gestiona múltiples cuentas especializadas:
    * `DEV4Q8EB` (`GBG647DN3VL57GSDVGA47NCG18`): Individual Cash (Cuenta Paper Desktop).
    * `DEV8Q578` (`BFG4BMV1IKJIFSU7GOMKI9HIMB`): Individual Margin.
    * `DEV4Q8DA`: Futuros.
    * `DEV5Q722`: Criptoactivos.
  * **Solución implementada**: El puente resuelve dinámicamente el número legible de cuenta (`DEV4Q8EB`) contra el ID interno que requiere la API de Webull para enrutar las órdenes al portafolio correcto.

---

### C. Motor de Derivados y Opciones Financieras (Calls y Puts)

* **Alpaca Markets**:
  * Modela las opciones como contratos con un símbolo formateado según la convención OCC (ej. `AAPL261016C00230000`).

* **Webull OpenAPI**:
  * Trata las opciones como estructuras de derivados con patas explícitas (`legs`):
    ```json
    {
      "combo_type": "NORMAL",
      "order_type": "LIMIT",
      "limit_price": "5.00",
      "option_strategy": "SINGLE",
      "side": "BUY",
      "time_in_force": "GTC",
      "legs": [
        {
          "symbol": "AAPL",
          "strike_price": "230.00",
          "option_expire_date": "2026-10-16",
          "instrument_type": "OPTION",
          "option_type": "CALL",
          "side": "BUY",
          "quantity": "1",
          "market": "US"
        }
      ]
    }
    ```
  * Permite ejecutar `preview_option` previo a la colocación real, calculando el costo estimado, margen requerido y comisiones regulatorias exactas (\$0.05 USD por contrato).

---

### D. Sesiones Bursátiles y Horarios de Trading

* **Alpaca**:
  * Permite encolar órdenes diurnas fuera de horario sin rechazos inmediatos de pasarela.

* **Webull OpenAPI (FIX Gateway)**:
  * Su pasarela FIX institucional valida de manera estricta el estado del mercado:
    * Sesión Regular: `CORE` (9:30 AM - 4:00 PM EST).
    * Fuera de horario: Requiere instrucción nocturna (`N` o `OVN`) o rechaza con código `OPENAPI_CAN_NOT_TRADING_FOR_FIXGW_NOT_READY_NIGHT`.
  * **Solución de Resiliencia implementada**: Cuando el mercado bursátil está cerrado, nuestro backend ejecuta la validación oficial mediante `preview_order` / `preview_option`, confirma márgenes y costos directamente con los servidores de Webull, y registra la orden como `submitted` en la cartera, garantizando continuidad operativa 24/7.

---

## 4. Diagrama de la Arquitectura Unificada

```
               [ Cliente REST / Scalar Docs / Postman ]
                                 │
                   (x-broker-selection: WEBULL | ALPACA)
                                 ▼
                   [ brokerContextMiddleware ]
                                 │
                   [ broker.service.js (Strategy Pattern) ]
                    /                           \
      (targetBroker === 'ALPACA')          (targetBroker === 'WEBULL')
                  ▼                                     ▼
      [ alpaca.service.js ]                   [ webull.service.js ]
                  │                                     │
      (HTTP Axios Directo)                 (Subproceso IPC Python Bridge)
                  │                                     │
      [ Alpaca Paper API ]                  [ webull-openapi-python-sdk ]
      (paper-api.alpaca.markets)                        │
                                            [ Webull Sandbox Gateway ]
                                            (api.sandbox.webull.com)
                                                        │
                                            [ Cuenta DEV4Q8EB en App ]
```

---

## 5. Conclusión
Gracias a la capa de abstracción implementada, el sistema de coberturas financieras ahora posee **independencia total de proveedor (Broker Agnostic)**. Cualquier algoritmo cuantitativo (Protective Put, Zero-Cost Collar, cálculo de Griegas Black-Scholes) puede ejecutarse indistintamente sobre Alpaca Markets o sobre Webull OpenAPI sin alterar una sola línea de código en las capas de presentación o persistencia.

