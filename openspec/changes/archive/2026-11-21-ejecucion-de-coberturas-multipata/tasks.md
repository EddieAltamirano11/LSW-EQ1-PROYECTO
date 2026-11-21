# Tasks

## 1. Verificaciones y pruebas primero

- [x] 1.1 Verificar si `tbl_hedging_strategies.status` tiene una restricción de valores en Supabase y, si la tiene, crear `scripts/migrate_add_partial_status_supabase.sql`.
- [x] 1.2 Confirmar con `preview_option` de Webull, sin emitir la orden, qué significa `limit_price` en `COVERED_STOCK`, y registrar el resultado.
- [x] 1.3 Escribir las pruebas `node:test` que fallan, con dobles de broker:
  - Put rechazado; Put aceptado y acciones rechazadas, con cancelación confirmada y con cancelación rechazada; pata ejecutada cuando falla otra (`409` y registro guardado).
  - Orden ausente del libro de órdenes; collar con `sharesCount: 10`; strike no listado; prima del cliente ignorada.
  - Collar del ranking usado tal cual, collar del ranking que ya no es apto (`400`) y activo sin resultado del Core 004.

## 2. Implementación

- [x] 2.1 Extender el modelo `HedgingStrategy` y el repositorio de Supabase con `PARTIALLY_EXECUTED` y los campos de orden por pata.
- [x] 2.2 Crear el orquestador de patas compartido: Put primero, detención en el primer rechazo, cancelación de las pendientes, estados del broker y respuesta `400` o `409`. Quitar las ramas `NODE_ENV` y `SIM-`.
- [x] 2.3 Implementar el Auto-Collar con el par del Core 004 (el del ranking o uno calculado), límites `ask`/`bid`, `sharesCount` múltiplo de 100 y el límite de `COVERED_STOCK` según la tarea 1.2.
- [x] 2.4 Implementar el Protective Put con `contractSymbol` o con el strike listado más cercano, con precios observados y sin respaldo al spot de la base.
- [x] 2.5 Registrar con fidelidad: símbolos OCC con el vencimiento real, identificadores y estados por pata, y primas obligatorias en `/hedging/collar-spread`.

## 3. Contrato, verificación y evidencia

- [x] 3.1 Actualizar `spec/openspec.yaml` y Postman: `400`/`409`/`502`/`503`, `contractSymbol` del Protective Put y cuerpo de la ejecución parcial.
- [x] 3.2 Ejecutar `npm test` y verificar en la cuenta paper un collar y un Protective Put. Crear el `REPORT-DrFIC.md` y correr `openspec validate ejecucion-de-coberturas-multipata --strict`.
