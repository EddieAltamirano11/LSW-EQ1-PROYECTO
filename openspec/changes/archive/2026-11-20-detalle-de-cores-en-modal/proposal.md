# Proposal

## Why

El profesor pidió ver los resultados de cada core sin saturar la interfaz: un "ojito" junto a cada core que muestre lo que calculó y si entró a la confluencia o solo al cálculo. Los componentes de detalle ya existen (`CoreResult` y `CoreDetail`), pero el Dashboard monta el panel con `hideAssetList`, así que no se ven. Por eso tampoco se cumple el requisito vigente de consultar el detalle de cada core por empresa.

## What Changes

- **Participación por core**: la API informa en cada core de cada empresa su `role` (`CONFLUENCE`, `GATE`, `DEPENDENCY`, `SYNTHESIS` o `NOT_COMPUTED`) y su `effectiveWeight` cuando entra a la confluencia.
- **Botón por core**: en el selector, cada core tiene un botón con ícono de ojo, separado del checkbox, con tooltip y etiqueta accesible («Ver resultados de Técnico»). Se agregan filas sin checkbox para Estrategia (004, siempre activo) y Confluencia (007).
- **Modal por core** con dos pestañas:
  - **Tabla**: una fila por empresa evaluada, con estado, puntaje, participación y datos clave. Cada fila se expande para ver su evidencia.
  - **Cómo se calcula**: fuentes, ventanas de datos, peso base y forma de participar.
  - Antes de evaluar, solo está disponible «Cómo se calcula».
- **Reutilización**: el modal usa `CoreResult` y `CoreDetail`, y se elimina la rama sin uso del panel (`hideAssetList = false`).
- La pestaña de gráficas se agrega en `graficas-de-cores`.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `strategy-screener-api`: requisito nuevo con la participación de cada core en el resultado.
- `presentacion-frontend-react`: requisito nuevo para consultar los resultados por core desde el selector.

## Impact

- **Endpoints**: `POST /api/v2/strategy-screener/run` agrega `role` y `effectiveWeight` a cada core. Es aditivo.
- **Código**: `strategyScreener.service.js`, `StrategyScreenerPanel.jsx`, un componente nuevo de modal, un descriptor de "Cómo se calcula" por core y `Dashboard.jsx`.
- **Depende de**: Vitest en el cliente (tarea 1.1 de `core-004-en-ranking`).
- **Evidencia**: implementación asistida por IA, registrada en el `REPORT-DrFIC.md` del change.

## Riesgos de integración

- **El ojo se confunde con activar o desactivar el core** → botón separado del checkbox, con tooltip y etiqueta accesible.
- **Muchas empresas en móvil** → tabla con desplazamiento y filas expandibles.
- **Lógica de presentación duplicada** → se reutiliza `CoreResult`.

## Plan de validación y rollback

- **Validación**:
  - pruebas backend de `role` y `effectiveWeight`;
  - pruebas de componente con cuatro estados: sin evaluar, cargando, error y con datos;
  - build y revisión manual.
- **Rollback**: revertir; los campos nuevos son aditivos.

## No-objetivos

- Gráficas, que van en otro change.
- Vista por empresa con todos sus cores desde la tabla del ranking.
- Cambiar los cálculos de los cores.
