# Design

## Context

- **Órdenes con valores fijos**: `createWebullOrder` completa los datos faltantes con precio 200 (acciones) o 5 (opciones), strike 230, spot 221.30 y vencimiento 2026-12-18. `createIBKROrder` usa strike 200 y vencimiento 2026-12-18. El bridge repite esos valores y usa 220 como cotización de respaldo.
- **Respuesta de acciones de Webull**: pone `filledQty = qty` y su mensaje dice "confirmada".
- **Validación de Buying Power**: calcula el costo con el precio límite, así que en órdenes `market` el costo es 0 y la validación se omite. También se omite si la lectura falla con un error que no es de Boom.
- **Validación de tenencia**: suma todas las posiciones del símbolo. Las de Webull no distinguen acciones de opciones (`assetClass` siempre es `us_stock`); las de IBKR usan `avgCost` como precio actual y `costBasis` como valor de mercado.
- **Bridge de Webull**:
  - `cmd_cancel_order` imprime `success: True` aunque el broker rechace la cancelación;
  - `cmd_account` usa 1,000,000 cuando falta un saldo;
  - `cmd_orders` devuelve éxito con una lista vacía si fallan las consultas.

## Goals / Non-Goals

**Goals:**
- Ningún valor inventado en órdenes, cancelaciones ni lecturas.
- Códigos HTTP coherentes en los tres brokers.

**Non-Goals:**
- Coberturas de varias patas.
- Cadena de opciones.
- Rediseño de los bridges.

## Decisions

### 1. Validación en un solo punto

`createBrokerOrder` valida los parámetros antes de las salvaguardas y antes de elegir el broker, así que la validación aplica igual a Alpaca, Webull e IBKR. Se eliminan los valores por defecto de `createWebullOrder`, de `createIBKROrder` y del bridge: los argumentos de argparse pasan a ser obligatorios y las órdenes `MARKET` no llevan `limit_price`.

- *Alternativa descartada*: validar en cada servicio de broker. Triplicaría las reglas.

### 2. Buying Power y tenencia sin omisiones

- En compras `market`, el costo se estima con el `ask` de `getBrokerQuote`.
- Si no se puede leer la cuenta, la cotización o las posiciones, se responde `503`; ya no se omite la validación.
- La tenencia suma solo posiciones de acciones. El tipo de instrumento se mapea desde Webull (el campo se confirma en la tarea 1.1) y desde IBKR (`secType`).

### 3. Respuestas y códigos

| Código | Significado |
|---|---|
| `201` | El broker devolvió un identificador de orden |
| `400` | Validación fallida o rechazo del broker, con su mensaje literal |
| `502` | Respuesta del broker inválida o incompleta (sin identificador o sin saldos) |
| `503` | El broker o la fuente no respondió |

El estado y la cantidad ejecutada se copian de la respuesta del broker; si no vienen, quedan en `null`.

### 4. Bridge de Webull

- `cmd_cancel_order` informa éxito solo ante un `200` de alguna de sus dos rutas (opción o acción). Si ambas fallan, devuelve los dos mensajes.
- `cmd_account` y `cmd_orders` devuelven error cuando falta un saldo o cuando una consulta no responde `200`.
- Se elimina el modo `--preview` si queda sin uso.

### 5. Lecturas

`getBrokerPositions` y `getBrokerOrders` (Alpaca y Webull) lanzan `503` o `502` en lugar de devolver `[]`. Las cotizaciones y las cuentas devuelven `null` en los campos no reportados. El modo `strict` del módulo de portafolio se mantiene.

## Risks / Trade-offs

- [Webull podría no exponer el tipo de instrumento en las posiciones] → si la muestra lo confirma, se usa ese campo; si no, se deduce del símbolo OCC de la posición. La decisión se registra en la evidencia.
- [Más llamadas al bridge, como la cotización para el Buying Power] → aumentan el bloqueo de `spawnSync`, que queda fuera de alcance y se documenta.

## Migration Plan

1. Bridge y servicios, con sus pruebas.
2. Despliegue del backend; el panel ya maneja estos errores.

## Open Questions

- ¿Qué campo identifica el tipo de instrumento en las posiciones de Webull? Se resuelve en la tarea 1.1.
