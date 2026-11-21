# Design

## Context

- **Candidato fabricado**: `activeCandidate` se arma cuando el activo seleccionado no está en `sortedCandidates`, con primas de 4.50 y 4.80 y probabilidades de 92 y 78. El Protective Put envía `putFloor.marketPremium` como precio límite.
- **Auto-Collar**: `handleExecuteCollar` arma su aviso con `orders.length || 3` y con los strikes del candidato. Ante un error de red, un `404` o un `401`, intenta en `v2` y luego en `v1`.
- **Screener**: `StrategyScreenerPanel` reintenta ante un `400` con `limit: 10` y sin `extraSymbols`.

## Goals / Non-Goals

**Goals:**
- Lo que se ve es lo que se envía.
- Sin respaldos inventados ni reintentos que cambien la operación.

**Non-Goals:**
- Cambios en el backend.

## Decisions

### 1. Vista previa en la boleta

- **Auto-Collar**: usa el collar del Core 004 que ya trae la respuesta del ranking. Si el activo no lo tiene, pide `POST /hedging/auto-collar` con `executeOrders: false`. Al emitir, envía los contratos mostrados.
- **Protective Put**: pide `GET /hedging/recommend-option/:symbol/PUT` y, al emitir, envía su `contractSymbol`.
- Sin vista previa, las coberturas se deshabilitan mostrando la causa.

### 2. Avisos y modal

El aviso de éxito toma la cantidad de órdenes y los contratos de `brokerExecution.orders`. El modal muestra `PARTIALLY_EXECUTED` y, para cada orden, su estado y su cantidad ejecutada.

### 3. Una sola solicitud por operación

- Se elimina el reintento "legacy" del screener, que además incumple el requisito vigente de mostrar los resultados de la consulta actual.
- Se elimina el reintento v2→v1, que podía duplicar órdenes.
- Ante un `401`, el panel pide iniciar sesión de nuevo, sin reenviar la orden.

## Risks / Trade-offs

- [Sin vista previa no se puede emitir una cobertura] → es el comportamiento buscado, y la causa queda visible.

## Migration Plan

1. Implementar después de `cadena-de-opciones-real`, `ejecucion-de-coberturas-multipata` y `core-004-en-ranking`.

## Open Questions

Ninguna que cambie el alcance.
