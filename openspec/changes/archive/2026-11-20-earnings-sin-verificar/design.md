# Design

## Context

- **Fecha inventada**: `obtenerFechaResultados` (en `marketData.js`) devuelve una fecha a +60 días cuando Webull falla o no trae fecha, con `estimated: true` y la fuente marcada como "(Estimado)".
- **Flujo actual sin fecha**:
  - `eventRisk` clasifica el riesgo por días;
  - `fundamentalCore` devuelve estado parcial y sin puntaje cuando no hay eventos;
  - `directSignalsCore` exige eventos;
  - el orquestador excluye las filas con `!events.result`.
- **Interfaz**: `CoreResult` ya muestra el riesgo de evento y la próxima fecha del 002, y la regla y el riesgo del 003.

## Goals / Non-Goals

**Goals:**
- Sin fechas inventadas.
- Un fallo del calendario no vacía el ranking.

**Non-Goals:**
- Fuentes nuevas de calendario.

## Decisions

### 1. Falla explícita del calendario

`obtenerFechaResultados` vuelve a lanzar `SourceError` cuando Webull falla o no entrega una fecha utilizable, como en `11be956`.

### 2. Riesgo `UNVERIFIED`

- `eventRisk` representa la falta de fecha como `UNVERIFIED`, con la causa y sin fecha.
- `fundamentalCore` calcula su puntaje, que no depende de los eventos, con estado `PARTIAL`.
- `directSignalsCore` devuelve `HOLD`, la regla `EVENT_UNVERIFIED`, `side 0` y el puntaje neutral de una abstención (65, igual que `INSUFFICIENT_CONFIRMATION`), con estado `PARTIAL`.
- El orquestador deja de excluir filas por `!events.result` y las marca como incompletas.
- *Alternativa descartada*: excluir la empresa, como decía la spec original. Un fallo de Webull vaciaría el ranking, y el usuario eligió conservar la posición.

### 3. Etiqueta en la consulta por core

`CoreResult` traduce `UNVERIFIED` a «Earnings sin verificar» y muestra la causa en lugar de la fecha.

## Risks / Trade-offs

- [Webull falla para muchos símbolos] → los resultados parciales quedan visibles; otra fuente se evaluará en otro change.

## Migration Plan

1. Backend, que puede desplegarse antes que el modal.
2. Etiqueta, junto con `detalle-de-cores-en-modal` o después.

## Open Questions

Ninguna que cambie el alcance.
