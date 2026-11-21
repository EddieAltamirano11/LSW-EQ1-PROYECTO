# Tasks

## 1. Pruebas primero

- [x] 1.1 Actualizar `test/scanner.v2.test.js` con un proveedor de cotizaciones de prueba y escribir las pruebas que fallan: activo sin cotización en `unavailable`, broker sin cotizaciones (`503`), ticker añadido sin cotización, `theoreticalPremium` y `pricing`, y ausencia de `technicalOutlook`.

## 2. Implementación

- [x] 2.1 Inyectar el proveedor de cotizaciones en `scanTopCollars`, quitar el respaldo a `referenceSpot` y la rama `NODE_ENV === 'test'`, y guardar en caché solo las cotizaciones válidas.
- [x] 2.2 Listar en `unavailable` los activos y los tickers añadidos sin cotización, y responder `503` si no hay ninguno.
- [x] 2.3 Renombrar `marketPremium` a `theoreticalPremium`, agregar `pricing` y retirar los datos técnicos fijos.
- [x] 2.4 Actualizar el cliente al campo nuevo y rotular como teóricos los valores del escáner en el ranking, la boleta y el modal.

## 3. Contrato, verificación y evidencia

- [x] 3.1 Documentar los cambios BREAKING en `spec/openspec.yaml` y en Postman, y actualizar la sección del escáner base de `docs/EXPLICACION_CORES_Y_RANKING.md`.
- [x] 3.2 Ejecutar `npm test` y el build, y revisar el ranking, la boleta y el modal. Crear el `REPORT-DrFIC.md` y correr `openspec validate escaner-sin-precios-fijos --strict`. Antes de archivar este change, archivar `v2-screener-tradingview`.
