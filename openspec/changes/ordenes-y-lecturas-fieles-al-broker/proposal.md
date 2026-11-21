# Proposal

## Why

El chequeo del 2026-11-18 encontró que las órdenes directas y las lecturas del broker devuelven datos inventados:

- las órdenes completan con valores fijos los parámetros que faltan (precio 200 o 5, strike 230, spot 221.30, vencimiento 2026-12-18);
- las respuestas reportan como ejecutada una orden que apenas se envió;
- el bridge de Webull informa cancelaciones exitosas aunque el broker las rechace, y reporta $1,000,000 de Buying Power cuando falta el dato;
- si falla una lectura de posiciones u órdenes, la API devuelve una lista vacía.

Las coberturas de varias patas dependen de estas piezas, así que se corrigen primero.

## What Changes

- **Parámetros obligatorios**: las órdenes exigen lado, tipo, cantidad, precio en `limit` y contrato completo en opciones. Ya no hay precios, strikes, vencimientos ni tipos por defecto, y las órdenes `market` se envían sin precio límite.
- **Buying Power** validado también en compras `market`, con el `ask` observado; `503` si no hay cuenta o cotización.
- **Tenencia** que cuenta solo acciones, no contratos de opciones; `503` si no se pueden leer las posiciones.
- **Respuestas fieles**: `201` solo con identificador de orden. El estado y la cantidad ejecutada son los que reporta el broker, o `null` si no los reporta. `400` ante rechazo, `502` ante respuesta inválida y `503` si el broker no responde.
- **Cancelación** exitosa solo si el broker la confirma.
- **Lecturas sin valores supuestos**: cuenta, posiciones, órdenes y cotizaciones con `null` en los campos no reportados y `502`/`503` en lugar de listas vacías. Las posiciones traen el tipo de instrumento y el precio de mercado reales.
- **Bridge de Webull** sin éxitos ni saldos por defecto.

## Capabilities

### New Capabilities

- `ejecucion-ordenes-broker`: órdenes directas, cancelaciones y lecturas de cuenta, posiciones, órdenes y cotizaciones contra los brokers reales, sin valores supuestos ni éxitos inventados.

### Modified Capabilities

Ninguna.

## Impact

- **Endpoints**: `POST` y `DELETE /api/v1|v2/broker/orders`, y `GET .../broker/account`, `positions`, `orders` y `quote/:symbol`.
- **Compatibilidad**: aparecen `400`, `502` y `503` donde antes había valores por defecto, listas vacías o éxitos, y campos en `null` cuando el broker no los reporta. El panel ya muestra estos errores en el modal y en la tarjeta de portafolio.
- **Código**: `broker.service.js`, `webull.service.js`, `ibkr.service.js` y `scripts/webull_desktop_bridge.py`.
- **Evidencia**: implementación asistida por IA (Claude Code), registrada en el `REPORT-DrFIC.md` del change con la distinción entre trabajo de IA y manual.

## Riesgos de integración

- **Campo de tipo de instrumento de Webull sin confirmar** → se confirma con una muestra real antes de implementar la validación de tenencia (tarea 1.1).
- **Más errores visibles** → son errores reales que antes se ocultaban; el modal y la tarjeta de portafolio ya los muestran.

## Plan de validación y rollback

- **Validación**: pruebas `node:test` con dobles de prueba sin red, pruebas `unittest` del bridge, `npm run test:api-quality` y una verificación manual contra la cuenta paper.
- **Rollback**: revertir el commit; no hay cambios de datos.

## No-objetivos

- Coberturas de varias patas (`ejecucion-de-coberturas-multipata`).
- Cadena de opciones (`cadena-de-opciones-real`).
- Sustituir `spawnSync` en los bridges.
