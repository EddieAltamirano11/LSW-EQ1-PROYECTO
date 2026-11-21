# Proposal

## Why

`getBrokerOptionsChain` genera para Alpaca y Webull una cadena sintética: strikes redondeados y primas `intrínseco + 2.0/3.5 + Math.random()`. IBKR hace lo mismo, sin el aleatorio, si su bridge falla. De esa cadena dependen `GET /broker/options-chain`, `recommendOption` y el Auto-Collar, que hoy usa esas primas como precio límite real. El screener de cores ya obtiene una cadena real (contratos de Alpaca con cotizaciones de Webull), así que se puede reutilizar.

## What Changes

- **Cadena real compartida**: un servicio común entrega contratos listados con `bid`, `ask`, volumen, interés abierto, instante, retraso y fuente. Lo usan el screener, `GET /broker/options-chain`, `recommendOption` y el Auto-Collar en los tres brokers, y se eliminan las cadenas sintéticas.
- **Selección del Core 004 reutilizable**: la regla con la que el Core 004 elige el collar queda disponible para el Auto-Collar.
- **Vistas previas sin órdenes**: `POST /hedging/auto-collar` con `executeOrders: false` devuelve el collar que elegiría el Core 004, y `GET /hedging/recommend-option/:symbol/PUT` devuelve un Put real. Ambos incluyen sus cotizaciones y no crean órdenes ni registros.
- `503` cuando no haya contratos cotizados.

## Capabilities

### New Capabilities

- `coberturas-cotizaciones-reales`: requisitos de cadena de opciones con cotizaciones observadas y de vista previa de coberturas. Después, `ejecucion-de-coberturas-multipata` agrega los de ejecución a la misma capability.

### Modified Capabilities

Ninguna.

## Impact

- **Endpoints**:
  - `GET /api/v1|v2/broker/options-chain/:symbol`;
  - `GET .../hedging/recommend-option/:symbol[/:type]` y su alias `recommend-collar`;
  - `POST .../hedging/auto-collar` con `executeOrders: false`.
- **Compatibilidad**: los contratos y las primas pasan de sintéticos a reales, con los mismos campos, y aparece `503` cuando no hay contratos.
- **Código**:
  - nuevo servicio compartido en `src/api/v1/services/`;
  - `strategyScreener/marketData.js`, que pasa a delegar en ese servicio;
  - `optionsCores.js`, que expone la selección del Core 004;
  - `broker.service.js`, `webull.service.js` e `ibkr.service.js`;
  - `hedging.service.js`, para la vista previa.
- **Evidencia**: implementación asistida por IA, registrada en el `REPORT-DrFIC.md` del change.

## Riesgos de integración

- **Regresión del screener** → `obtenerCadenaOpciones` delega en el servicio nuevo y debe devolver lo mismo; las pruebas del screener lo cubren.
- **Símbolos sin cotización de opciones en Webull** → `503` con la causa, en lugar de primas inventadas.

## Plan de validación y rollback

- **Validación**: pruebas del servicio y de las rutas con dobles de prueba, `test/strategyScreener.v2.test.js` sin cambios de resultado y una consulta real fechada.
- **Rollback**: revertir; no hay cambios de datos.

## No-objetivos

- Emitir órdenes de coberturas (`ejecucion-de-coberturas-multipata`).
- Una cadena distinta por broker.
