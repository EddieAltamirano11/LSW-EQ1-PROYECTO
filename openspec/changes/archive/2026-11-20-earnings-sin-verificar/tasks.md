# Tasks

## 1. Pruebas primero

- [x] 1.1 Escribir en `test/strategyScreener.v2.test.js` las pruebas que fallan:
  - Calendario caído: la empresa conserva su posición con riesgo `UNVERIFIED`, el 003 devuelve `HOLD` con `EVENT_UNVERIFIED`, el estado es parcial y no hay evidencia del calendario.
  - Calendario con fecha: el riesgo se clasifica como hasta ahora.
- [x] 1.2 Escribir la prueba de componente que falla: la consulta de Fundamental muestra «Earnings sin verificar» con la causa y sin fecha.

## 2. Implementación

- [x] 2.1 Eliminar la fecha estimada de `obtenerFechaResultados` y lanzar `SourceError` cuando no haya una fecha utilizable.
- [x] 2.2 Representar `UNVERIFIED` en `eventRisk`, calcular el 002 con estado parcial, hacer que el 003 se abstenga y dejar de excluir filas por falta de fecha.
- [x] 2.3 Mostrar «Earnings sin verificar» en la consulta por core. Requiere `detalle-de-cores-en-modal`.

## 3. Contrato, verificación y evidencia

- [x] 3.1 Actualizar `spec/openspec.yaml`, el ejemplo de Postman y la sección de riesgo de eventos de `docs/EXPLICACION_CORES_Y_RANKING.md`.
- [x] 3.2 Ejecutar `npm test` y el build, crear el `REPORT-DrFIC.md` y correr `openspec validate earnings-sin-verificar --strict`.
