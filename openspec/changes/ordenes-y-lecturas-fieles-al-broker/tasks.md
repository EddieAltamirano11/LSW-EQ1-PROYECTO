# Tasks

## 1. Muestra real y pruebas primero

- [x] 1.1 Registrar una muestra fechada, sin credenciales, de las posiciones de Webull con acciones y opciones, e identificar el campo que distingue el tipo de instrumento.
- [x] 1.2 Escribir las pruebas `node:test` que fallan, con dobles de prueba y sin red: parámetros obligatorios, Buying Power en `market`, tenencia solo de acciones, respuestas `201`/`400`/`502`/`503`, cancelación confirmada y lecturas sin valores supuestos.
- [x] 1.3 Escribir las pruebas `unittest` del bridge que fallan, siguiendo `test/portafolio_puentes_test.py`: cancelación solo con `200`, cuenta sin saldos, consultas de órdenes fallidas, argumentos obligatorios y `MARKET` sin `limit_price`.

## 2. Implementación

- [x] 2.1 Validar los parámetros en `createBrokerOrder` y quitar los valores por defecto de `createWebullOrder` y `createIBKROrder`.
- [x] 2.2 Validar el Buying Power en compras `market` con el `ask` observado y la tenencia solo con acciones, y responder `503` cuando falten la cuenta, la cotización o las posiciones.
- [x] 2.3 Hacer fieles las respuestas de emisión y de cancelación: `201` solo con identificador, estado y cantidad del broker o `null`, y `400`/`502`/`503`.
- [x] 2.4 Quitar los valores supuestos de las lecturas de cuenta, cotización, posiciones y órdenes de los tres brokers, y hacer que fallen en lugar de devolver listas vacías.
- [x] 2.5 Corregir el bridge de Webull: cancelación, cuenta, órdenes, argumentos obligatorios, `MARKET` sin `limit_price` y retiro de `--preview` si queda sin uso.

## 3. Contrato, verificación y evidencia

- [x] 3.1 Actualizar en `spec/openspec.yaml` y en las colecciones Postman los endpoints de `/broker`, con sus errores y sus campos `null`.
- [ ] 3.2 Ejecutar `npm test`, las pruebas del bridge y `npm run test:api-quality`, y verificar manualmente contra la cuenta paper. Crear el `REPORT-DrFIC.md` con la distinción entre trabajo de IA y manual, y correr `openspec validate ordenes-y-lecturas-fieles-al-broker --strict`.
