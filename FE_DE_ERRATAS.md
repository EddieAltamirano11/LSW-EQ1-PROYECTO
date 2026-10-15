# Fe de Erratas y Bitácora de Correcciones Técnicas del Sistema de Coberturas

**Proyecto:** Microservicio de Coberturas Financieras y Conexión Bursátil (FIC-generator / LSW-EQ1-PROYECTO)  
**Institución:** Tecnológico Nacional de México / Instituto Tecnológico de Tepic  
**Materia:** Lenguajes del Servidor Web (Unidad 2 - Actividad 2)  
**Fecha:** 15 de Octubre de 2026  
**Resultado de Validación Automatizada:** **44 de 44 APIs Aprobadas (100% PASS)**

---

## 1. Incidencias Identificadas y Soluciones Implementadas

### Incidencia 1: Error 417 en Webull al emitir Short Call (`OPENAPI_OPTION_CAVERED_CALL_STOCK_NO_ENOUGH`)
* **Diagnóstico:** Al calibrar la estrategia Collar en Webull fuera de horario o de forma secuencial, la API oficial de Webull OpenAPI rechazaba la venta del contrato Call (`side: SELL`, `order_type: SINGLE`) indicando que no existían acciones de la empresa liquidadas en la cuenta (`NO_ENOUGH_STOCK`), a pesar de haber enviado la orden de compra de acciones milisegundos antes.
* **Causa Raíz:** El mercado bursátil estadounidense requiere compensación (settlement) o bien la emisión atómica de combos multileg cuando una posición corta de Call se encuentra respaldada por títulos subyacentes.
* **Solución Implementada:** Se modificó `scripts/webull_desktop_bridge.py` y `src/api/v1/services/webull.service.js` para detectar intentos de venta de Call y empaquetarlos mediante la estructura oficial `combo_type: "COVERED_STOCK"`. Con esta arquitectura, Webull acepta la orden combinada (acciones + call vendido) en una sola llamada con código HTTP 200 y asignación de `order_id` en firme.

---

### Incidencia 2: Reemplazo y Evolución de `recommend-collar` hacia `recommend-option`
* **Diagnóstico:** El endpoint `/hedging/recommend-collar/:symbol` estaba rígidamente acoplado a la estructura completa de un Collar simulado, impidiendo a los desarrolladores y clientes Postman consultar y evaluar opciones individuales específicas (PUT para piso de seguro o CALL para techo de ganancia) contra la cadena de opciones real del broker.
* **Solución Implementada:** 
  1. Se actualizó el contrato OpenSpec (`spec/openspec.yaml`) registrando `/hedging/recommend-option/{symbol}` con soporte de query param `type` (`PUT` o `CALL`), `broker` (`WEBULL` o `ALPACA`), `expiration` y `moneyness` (`OTM`, `ATM`, `ITM`).
  2. Se desarrolló `HedgingService.recommendOption()` en `src/api/v1/services/hedging.service.js`, evaluando cada contrato disponible con el motor cuantitativo Black-Scholes ($F0$), calculando sus 5 Griegas analíticas ($\Delta, \Gamma, \Theta, \mathcal{V}, \rho$) y validando la relación de prima justa (`fairRatio = marketPremium / theoreticalPriceBS`).
  3. Se conectaron el controlador (`hedging.controller.js`) y las rutas (`hedging.routes.js`), preservando un alias de compatibilidad hacia `recommend-collar`.

---

### Incidencia 3: Desfase de Precio Spot en MongoDB al validar Strikes OTM en `collar-spread` Manual
* **Diagnóstico:** Al invocar `POST /hedging/collar-spread` omitiendo `spotPrice` en el cuerpo de la petición, el servicio consultaba la colección `underlyings` de la base de datos local, la cual contenía registros estáticos previos (ej. NVDA a $125.80 USD). Al validar un Put Strike de $200.00 USD, el sistema arrojaba error 400 indicando que el Put no era Out-of-the-Money ($K_{put} \ge S$).
* **Solución Implementada:** Se actualizó la resolución de precio subyacente en `createCollarSpread` y `createProtectivePut` (`src/api/v1/services/hedging.service.js`) para consultar prioritariamente la cotización spot en tiempo real del broker seleccionado (`getBrokerQuote`) antes de recurrir a los registros de la base de datos. Si el cliente envía `spotPrice` en el JSON, este prevalece.

---

### Incidencia 4: Validación Estricta de Esquema Mongoose en Inserción de Subdocumentos `Legs`
* **Diagnóstico:** Al enviar peticiones de prueba a `POST /hedging/:id/legs` utilizando nombres de campo alternativos o de uso común en opciones (`premium` en lugar de `entryPrice`, `contracts` en lugar de `quantity`, o roles no contemplados en el enum rígido), Mongoose rechazaba la operación con código HTTP 400 (`ValidationError`).
* **Solución Implementada:** Se reforzó el repositorio `src/api/v1/repositories/hedging.mongo.repo.js` en los métodos `addLeg` y `addLegsBatch` con una capa de normalización defensiva:
  * Si se omite `assetType`, se infiere automáticamente (`OPTION` si existe `optionType`, o `EQUITY`).
  * Si `legRole` no pertenece al enum principal, se mapea dinámicamente (`HEDGE_FLOOR` para PUT, `FINANCE_CEILING` para CALL, o `UNDERLYING` para acciones).
  * Mapeo transparente de `premium` a `entryPrice` y de `contracts` a `quantity`.

---

### Incidencia 5: Gating Cuantitativo Pre-Trade ($F0$) en `auto-collar`
* **Diagnóstico:** Al ejecutar un Collar automático con órdenes en vivo (`executeOrders: true`), existía el riesgo de que el broker ejecutara órdenes de opciones ilíquidas a precios distorsionados (spreads bid-ask excesivos).
* **Solución Implementada:** Se incorporó un filtro de seguridad estricto previo a la persistencia y emisión de órdenes. Antes de enviar cualquier orden al mercado o registrar la cobertura, el algoritmo evalúa:
  $$\text{fairRatio} = \frac{\text{Prima de Mercado}}{\text{Precio Teórico Black-Scholes}}$$
  Si el ratio de sobreprecio supera el umbral seguro ($0.05 \le \text{fairRatio} \le 8.0$), la operación se cancela automáticamente con una excepción descriptiva, protegiendo el capital del fondo.

---

## 2. Resumen de Ejecución de Pruebas

| Subsistema / Módulo | Endpoints Evaluados | Estado | Observaciones |
| :--- | :---: | :---: | :--- |
| **Núcleo & Telemetría** | 2 | **100% PASS** | `/` y `/spec.json` operativos. |
| **Autenticación Políglota** | 2 | **100% PASS** | Login y Session validados con MongoDB y Supabase. |
| **Activos Subyacentes (CRUD)** | 6 | **100% PASS** | Creación, lectura, edición, lote y borrado validados. |
| **Motor Cuantitativo F0** | 2 | **100% PASS** | Black-Scholes y Newton-Raphson validados con KaTeX. |
| **Recomendación Algorítmica** | 4 | **100% PASS** | `recommend-option` validado en Webull y Alpaca (PUT y CALL). |
| **Estrategias de Cobertura** | 5 | **100% PASS** | Auto-Collar, Protective Put, Collar Manual y Batch. |
| **Subdocumentos (Underlying & Legs)** | 8 | **100% PASS** | CRUD completo de subdocumentos embebidos. |
| **Métricas Cuantitativas & Payoff** | 3 | **100% PASS** | Recálculo de métricas y generación de matriz vectorial P&L. |
| **Integración Bursátil Webull** | 6 | **100% PASS** | Cuenta, posiciones, órdenes, cotización, cadena y emisión. |
| **Integración Bursátil Alpaca** | 6 | **100% PASS** | Cuenta, posiciones, órdenes, cotización, cadena y emisión. |
| **TOTAL** | **44** | **100% PASS** | **Cero fallos en entorno de producción.** |

