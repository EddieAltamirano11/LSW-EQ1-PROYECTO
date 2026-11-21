# Tasks

## 1. Pruebas primero

- [x] 1.1 Escribir las pruebas que fallan del servicio compartido: contratos listados con cotización, instante, retraso y fuente; descarte de retrasos mayores a 15 minutos; `503` sin contratos; y la misma salida de `obtenerCadenaOpciones` que hoy.
- [x] 1.2 Escribir las pruebas que fallan de las rutas: `GET /broker/options-chain` sin contratos ajenos a la lista del proveedor, vista previa del Auto-Collar igual a la selección del Core 004 sin órdenes ni registros, y recomendación de un Put real.

## 2. Implementación

- [x] 2.1 Extraer el servicio compartido a `src/api/v1/services/` y hacer que `obtenerCadenaOpciones` delegue en él.
- [x] 2.2 Reemplazar las cadenas sintéticas de Alpaca, Webull e IBKR por el servicio compartido, con `503` cuando no haya contratos cotizados.
- [x] 2.3 Exponer desde `optionsCores.js` la selección del Core 004 y sus reglas de liquidez, y usarlas en `recommendOption`.
- [x] 2.4 Implementar las vistas previas del Auto-Collar (`executeOrders: false`) y del Protective Put (`recommend-option/PUT`), sin enviar órdenes ni guardar.

## 3. Contrato, verificación y evidencia

- [x] 3.1 Actualizar `spec/openspec.yaml` y Postman: cadena, recomendación y vista previa del Auto-Collar.
- [x] 3.2 Ejecutar `npm test` y una consulta real fechada, crear el `REPORT-DrFIC.md` y correr `openspec validate cadena-de-opciones-real --strict`.
