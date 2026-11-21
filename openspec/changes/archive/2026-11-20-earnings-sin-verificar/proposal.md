# Proposal

## Why

Si Webull no entrega la fecha de earnings, `obtenerFechaResultados` inventa una a +60 días y la atribuye a "Webull · Financial Alerts (Estimado)". Eso deja el riesgo de evento en `LOW`, y el Core 003 nunca aplica la regla de riesgo por earnings. El problema lo introdujo `6425f51`; en `11be956` la función fallaba, como exige la spec.

## What Changes

- **Sin fecha inventada**: `obtenerFechaResultados` falla cuando no hay una fecha utilizable.
- **Riesgo `UNVERIFIED`**: el riesgo de evento queda como `UNVERIFIED`, con la causa. La empresa conserva su posición si el resto de sus datos está disponible.
- **Fundamental (002)** calcula su puntaje sin el componente de eventos y queda como parcial.
- **Señales directas (003)** se abstiene con `HOLD` y la regla `EVENT_UNVERIFIED`. La respuesta se marca como parcial.
- **Interfaz**: la consulta por core muestra «Earnings sin verificar» con la causa.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `strategy-screener-api`: requisito nuevo de riesgo de eventos sin verificar.
- `presentacion-frontend-react`: requisito nuevo para mostrar «Earnings sin verificar» en la consulta por core.

## Impact

- **Endpoints**: `POST /api/v2/strategy-screener/run`.
- **Compatibilidad**: aparecen `UNVERIFIED` en el riesgo de eventos, `EVENT_UNVERIFIED` en el Core 003 y más respuestas `PARTIAL`. Desaparecen las fechas estimadas.
- **Código**: `marketData.js`, `fundamentalCore.js`, `technicalCore.js` (`directSignalsCore`), el orquestador del screener y la consulta por core del cliente.
- **Depende de**: `detalle-de-cores-en-modal`, para la parte visual.
- **Evidencia**: implementación asistida por IA, registrada en el `REPORT-DrFIC.md` del change.

## Riesgos de integración

- **Más respuestas parciales si Webull falla seguido** → se muestran como parciales con la causa, sin vaciar el ranking.
- **La parte visual depende del modal** → el backend se puede desplegar antes, y la etiqueta llega con el modal.

## Plan de validación y rollback

- **Validación**: pruebas del screener con el calendario caído y con fecha, prueba de componente de la etiqueta y actualización del documento de cores.
- **Rollback**: revertir.

## No-objetivos

- Buscar otra fuente para el calendario de resultados.
- Cambiar los pesos de la confluencia.
