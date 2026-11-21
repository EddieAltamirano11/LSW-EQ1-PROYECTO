# Design

## Context

- **Cadenas sintéticas**: `getBrokerOptionsChain` (Alpaca), `getWebullOptionsChain` y el respaldo de `getIBKROptionsChain` generan strikes redondeados a 5 y primas `intrínseco + 2.0/3.5 (+ Math.random())`. Las consumen `GET /broker/options-chain`, `recommendOption` y `autoCalibrateAndCreateCollar`.
- **Cadena real existente**: `obtenerCadenaOpciones` (en `strategyScreener/marketData.js`) ya obtiene contratos activos de Alpaca y cotizaciones firmadas de Webull, y descarta retrasos mayores a 15 minutos y cotizaciones fuera de la sesión. `optionsCores.js` aplica las reglas de liquidez (`liquid`) y la selección del collar (`strategyCore`).
- **Dirección de dependencias**: hoy `v2` depende de `v1`; por ejemplo, `scanner.service.js` importa `broker.service.js`.

## Goals / Non-Goals

**Goals:**
- Una sola cadena real para el screener y las coberturas.
- Vistas previas con datos reales.
- Sin regresión en el screener.

**Non-Goals:**
- Ejecución de órdenes.
- Una cadena por broker.

## Decisions

### 1. Servicio compartido en `v1`

Se extraen de `marketData.js` a `src/api/v1/services/` (nombre tentativo `optionsChain.service.js`) la consulta de contratos de Alpaca, la firma de Webull y la normalización de snapshots. `obtenerCadenaOpciones` delega en ese servicio.

| Alternativa descartada | Motivo |
|---|---|
| Que `hedging.service.js` importe directamente de `v2/services/strategyScreener` | Invierte la dirección de dependencias, porque `v2` depende de `v1` |
| Una cadena por broker (snapshots de Alpaca, bridge de Webull, `options_chain` de TWS) | Triplica integraciones y pruebas; la de IBKR depende del túnel TCP y no se verificó que entregue instantes de cotización |
| Conservar las cadenas sintéticas con una etiqueta | Viola la regla de cero simulación |

Consecuencia: las primas de Alpaca e IBKR vienen de cotizaciones de Webull OpenAPI, y la respuesta lo declara en `source` y `delayMinutes`.

### 2. Selección del Core 004 expuesta

`optionsCores.js` exporta `liquid` y la selección de `strategyCore`. Así el Auto-Collar elige exactamente el collar que el Core 004 muestra en el ranking, y `recommendOption` usa las mismas reglas de liquidez.

### 3. Vistas previas

- `POST /hedging/auto-collar` con `executeOrders: false` corre la selección del Core 004 sobre la cadena real y responde contratos, cotizaciones y métricas, sin enviar órdenes ni guardar.
- `GET /hedging/recommend-option/:symbol/PUT` devuelve un Put listado con su `ask`, instante y fuente.

## Risks / Trade-offs

- [Webull no cotiza opciones de un símbolo] → `503` con la causa; la vista previa explica por qué no hay cobertura.
- [Cotizaciones con hasta 15 minutos de retraso] → se informan el instante y el retraso.

## Migration Plan

1. Servicio compartido, con el screener delegando en él sin cambiar su resultado.
2. Reemplazo de las cadenas sintéticas y vistas previas.

## Open Questions

Ninguna que cambie el alcance.
