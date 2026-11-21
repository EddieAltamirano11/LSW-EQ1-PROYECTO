# Spec Delta

## Purpose

Emitir, cancelar y consultar órdenes, cuentas, posiciones y cotizaciones en Webull, Alpaca e IBKR reflejando solo lo que reporta el broker.

## ADDED Requirements

### Requirement: Parámetros completos antes de emitir una orden

`POST /api/v1/broker/orders` (y su equivalente en `/api/v2`), así como toda emisión interna de órdenes, SHALL rechazar con `400`, antes de contactar al broker, una orden que no indique explícitamente:

- símbolo, lado, tipo y una cantidad entera positiva;
- un precio límite positivo en órdenes `limit`;
- un contrato completo en opciones: tipo, strike y vencimiento, o símbolo OCC.

El sistema SHALL NOT completar los datos faltantes con precios, strikes, vencimientos, precios del subyacente ni tipos de opción predeterminados. Las órdenes `market` SHALL enviarse sin precio límite.

#### Scenario: Orden límite sin precio
- **WHEN** se solicita una compra `limit` de acciones sin `limitPrice`
- **THEN** la API responde `400` indicando el campo faltante y no envía ninguna orden al broker

#### Scenario: Opción sin contrato completo
- **WHEN** se solicita una orden de opción sin strike o sin vencimiento
- **THEN** la API responde `400` y no se emite ninguna orden con un strike o vencimiento supuestos

#### Scenario: Orden de mercado
- **WHEN** se solicita una compra `market` válida
- **THEN** la orden llega al broker sin precio límite

### Requirement: Validación de Buying Power con datos del broker

Antes de emitir una compra, el sistema SHALL estimar su costo multiplicando la cantidad por el precio límite o, en órdenes `market`, por el `ask` observado del instrumento. En opciones SHALL multiplicar además por el multiplicador del contrato.

SHALL comparar ese costo con el Buying Power que reporta el broker:

- Si el costo lo supera, SHALL responder `400` con el costo estimado y el Buying Power disponible.
- Si no puede leer la cuenta o la cotización necesarias, SHALL responder `503` sin emitir la orden.

#### Scenario: Compra de mercado que excede el Buying Power
- **WHEN** se solicita comprar a mercado una cantidad cuyo costo, calculado con el `ask` observado, supera el Buying Power reportado
- **THEN** la API responde `400` con el costo estimado y el Buying Power disponible, sin emitir la orden

#### Scenario: Cuenta o cotización no disponibles
- **WHEN** el broker no entrega el Buying Power o la cotización necesaria para estimar una compra
- **THEN** la API responde `503` y no emite la orden

### Requirement: Validación de tenencia para ventas de acciones

Antes de emitir una venta de acciones, el sistema SHALL sumar únicamente las posiciones de acciones del símbolo que reporte el broker, sin contar contratos de opciones.

- Si la cantidad solicitada supera esa tenencia, SHALL responder `400` con la tenencia encontrada.
- Si no puede leer las posiciones, SHALL responder `503` en lugar de informar que el usuario no tiene acciones.

#### Scenario: Posición mixta de acciones y opciones
- **WHEN** el usuario tiene 100 acciones y 5 contratos de opciones del mismo símbolo y solicita vender 105 acciones
- **THEN** la API responde `400` e informa una tenencia de 100 acciones

#### Scenario: Posiciones no disponibles
- **WHEN** el broker no responde a la consulta de posiciones durante la validación de una venta
- **THEN** la API responde `503` y no afirma que el usuario carece de acciones

### Requirement: Respuesta de emisión fiel al broker

La API SHALL responder `201` solo cuando el broker devuelva un identificador de orden.

- El estado y la cantidad ejecutada SHALL ser los que reporte el broker; si no los reporta, SHALL quedar en `null`.
- Mientras el broker no informe el llenado, el mensaje SHALL describir la orden como enviada o aceptada, no como ejecutada.

Códigos de error:

| Situación | Código |
|---|---|
| El broker rechaza la orden | `400`, con el mensaje literal del broker |
| El broker responde sin identificador o con una respuesta ilegible | `502` |
| El broker no responde | `503` |

#### Scenario: Orden aceptada sin llenado informado
- **WHEN** el broker acepta una orden de 100 acciones y devuelve su identificador sin datos de llenado
- **THEN** la API responde `201` con ese identificador y cantidad ejecutada `null`, sin reportar 100 acciones ejecutadas

#### Scenario: Rechazo del matching engine
- **WHEN** el broker rechaza la orden por poder de compra insuficiente
- **THEN** la API responde `400` con el mensaje textual del broker

### Requirement: Cancelación confirmada por el broker

`DELETE /api/v1/broker/orders/:id` SHALL responder éxito solo cuando el broker confirme la cancelación. Si el broker la rechaza, SHALL responder `400` con su mensaje; si no responde, `503`.

#### Scenario: Cancelación rechazada
- **WHEN** Webull rechaza la cancelación de una orden ya ejecutada
- **THEN** la API responde `400` con el mensaje de Webull y no informa la orden como cancelada

#### Scenario: Cancelación confirmada
- **WHEN** el broker confirma la cancelación de una orden pendiente
- **THEN** la API responde éxito con la confirmación del broker

### Requirement: Lecturas de cuenta, posiciones, órdenes y cotizaciones sin valores supuestos

Las consultas de cuenta, posiciones, órdenes y cotizaciones SHALL devolver únicamente valores reportados por el broker. Los campos que el broker no reporte SHALL quedar en `null`. La API SHALL NOT sustituirlos por saldos, identificadores de cuenta, precios, tamaños, volatilidades, fechas, estados ni nombres de empresa predeterminados.

- **Saldos incompletos**: si falta un saldo requerido (efectivo, valor del portafolio o Buying Power), la consulta de cuenta SHALL responder `502`.
- **Consultas fallidas**: si una consulta falla, SHALL responder `502` o `503` en lugar de una lista vacía. Una lista vacía SHALL significar que el broker confirmó que no hay elementos.
- **Posiciones**: cada posición SHALL indicar el tipo de instrumento reportado (acción u opción) y el precio y valor de mercado reportados. El costo promedio SHALL NOT usarse como precio actual.

#### Scenario: Balance incompleto en Webull
- **WHEN** la respuesta de balance de Webull no incluye el Buying Power
- **THEN** la API responde `502` y no reporta un Buying Power predeterminado

#### Scenario: Falla al consultar posiciones
- **WHEN** el broker no responde a la consulta de posiciones
- **THEN** la API responde `503` con la causa en lugar de una lista vacía

#### Scenario: Cotización sin bid ni ask
- **WHEN** el broker entrega el último precio sin bid ni ask
- **THEN** la cotización devuelve `bid` y `ask` en `null`, sin calcularlos a partir del último precio
