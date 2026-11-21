# Proposal

## Why

La terminal de órdenes muestra y envía valores inventados:

- Si el activo no está en el ranking, arma un candidato con prima de $4.50 y probabilidades de 92% y 78%, y el Protective Put manda esa prima como límite.
- El aviso de éxito del Auto-Collar usa `orders.length || 3` y los strikes del escáner, no los que se enviaron.
- El panel reintenta solicitudes cambiándolas: el screener repite la consulta sin los tickers del usuario, y el Auto-Collar reintenta en otra versión de la API, lo que podría duplicar órdenes.

## What Changes

- **Vista previa real antes de emitir**:
  - Auto-Collar: el collar del Core 004 del ranking o, si el activo no lo tiene, la vista previa del backend; se rotula «Collar», con su costo neto.
  - Protective Put: la recomendación real, con su `contractSymbol`.
- **Sin candidato fabricado**: si no hay vista previa, las coberturas se deshabilitan; las órdenes de acciones siguen disponibles.
- **Avisos y modal**: los avisos de éxito se construyen con las órdenes y los contratos de la respuesta. Ante un `409`, el modal destaca `PARTIALLY_EXECUTED` y el estado de cada orden.
- **Sin reintentos que alteren la operación**: se quitan el reintento "legacy" del screener y el reintento v2→v1 del Auto-Collar. Ante un error de red, el panel indica revisar las órdenes en el broker.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `presentacion-frontend-react`: modifica la presentación de órdenes y la compatibilidad de la interfaz, y agrega el requisito de solicitudes sin reintentos que alteren la operación.

## Impact

- **Código**: `Dashboard.jsx`, `StrategyScreenerPanel.jsx` y `BrokerExecutionModal.jsx`.
- **Compatibilidad**: el Protective Put envía `contractSymbol`, y desaparecen los respaldos que inventan datos o repiten solicitudes.
- **Depende de**:
  - `cadena-de-opciones-real` (vistas previas);
  - `ejecucion-de-coberturas-multipata` (contratos y respuesta `409`);
  - `core-004-en-ranking` (collar de la tabla y Vitest).
- **Evidencia**: implementación asistida por IA, registrada en el `REPORT-DrFIC.md` del change.

## Riesgos de integración

- **Depende de otros tres changes** → se implementa al final del bloque de ejecución.
- **Errores que antes se ocultaban ahora son visibles** → el usuario ve la causa real en el modal.

## Plan de validación y rollback

- **Validación**: pruebas de componente con Vitest, build y revisión manual en escritorio y móvil de la vista previa, el activo sin datos, el aviso de éxito, el `409` y el error de cores.
- **Rollback**: revertir el frontend.

## No-objetivos

- Emitir órdenes desde la tabla del ranking.
- Cambios en el backend.
