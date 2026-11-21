# Spec Delta

## Purpose

Estructurar, previsualizar y emitir Auto-Collar y Protective Put con contratos listados y cotizaciones observadas, y registrar exactamente lo que quedó en el broker.

## ADDED Requirements

### Requirement: Precios de las patas tomados de cotizaciones observadas

Al ejecutar, el sistema SHALL volver a cotizar cada contrato y el subyacente. Como precio límite SHALL usar el `ask` observado en las compras y el `bid` observado en las ventas.

Selección de contratos:

- **Auto-Collar**: SHALL usar el par Put/Call que selecciona el Core 004 para el activo, el mismo que muestra el ranking.
  - Si la solicitud incluye los contratos del ranking, SHALL usarlos con cotizaciones nuevas, siempre que sigan cumpliendo las reglas de liquidez y de costo base del Core 004. Si dejaron de cumplirlas, SHALL responder `400` con la causa y sin enviar órdenes.
  - Si la solicitud no los incluye, SHALL calcular en ese momento la selección del Core 004 sobre la cadena real.
- **Protective Put**: SHALL usar el contrato indicado en `contractSymbol`. Si no se indica, SHALL usar, para el vencimiento elegido, el strike listado más cercano que sea menor o igual al solicitado.

Valores que SHALL NOT usarse:

- `putPremium` y `spotPrice` enviados por el cliente, como precios límite;
- el precio guardado en la base de datos, como sustituto de una cotización.

La respuesta SHALL indicar los contratos, strikes, vencimientos y precios efectivamente enviados.

#### Scenario: Prima del cliente distinta de la cotización
- **WHEN** se solicita un Protective Put con `putPremium: 4.50` y el `ask` observado del contrato es 6.10
- **THEN** la orden del Put se envía con límite 6.10 y la respuesta informa ese precio

#### Scenario: Strike solicitado no listado
- **WHEN** se solicita un Protective Put con strike 216 y los strikes listados cercanos son 215 y 220
- **THEN** se usa el contrato con strike 215 y la respuesta lo indica

#### Scenario: Cotización no disponible al ejecutar
- **WHEN** al momento de ejecutar no hay una cotización observada vigente del subyacente o de alguno de los contratos
- **THEN** la API responde `503` sin enviar órdenes

#### Scenario: Auto-Collar con el collar del ranking
- **GIVEN** el ranking muestra para AAPL el collar del Core 004 con el Put 215 y el Call 240
- **WHEN** se emite el Auto-Collar de AAPL con esos contratos
- **THEN** las órdenes usan exactamente esos contratos, con precios límite tomados de cotizaciones nuevas

#### Scenario: Collar del ranking que ya no es apto
- **WHEN** al emitir, el Call del ranking ya no cumple las reglas de liquidez del Core 004
- **THEN** la API responde `400` con la causa y no envía órdenes

#### Scenario: Activo sin resultado del Core 004
- **WHEN** se emite el Auto-Collar de SPY, que no forma parte del universo de los cores
- **THEN** el sistema calcula en ese momento la selección del Core 004 sobre la cadena real y emite ese par

### Requirement: Orden de envío y compensación de patas

**Orden de envío**: en coberturas de varias patas, el sistema SHALL enviar primero la pata de cobertura (Put) y después las demás. En el Auto-Collar, el Call SHALL enviarse después de las acciones que lo cubren o dentro de la misma orden combinada.

**Compensación**: si una pata es rechazada o falla, el sistema:

- SHALL dejar de enviar patas;
- SHALL solicitar la cancelación de las patas aceptadas que no se hayan ejecutado por completo;
- SHALL NOT enviar órdenes de cierre para las patas ya ejecutadas.

**Resultado después de la compensación**:

- Si alguna pata quedó viva, ejecutada total o parcialmente, o con una cancelación no confirmada, SHALL guardar la estrategia con estado `PARTIALLY_EXECUTED` y el estado real de cada orden, y SHALL responder `409`.
- Si ninguna pata quedó viva ni ejecutada, SHALL responder `400` sin guardar la estrategia.

Ambas respuestas SHALL listar cada orden con su identificador, estado, cantidad ejecutada y mensaje del broker.

#### Scenario: Put rechazado
- **WHEN** el broker rechaza el Put de un Protective Put
- **THEN** no se envía la orden de acciones, no se guarda la estrategia y la API responde `400` con el mensaje del broker

#### Scenario: Put aceptado y acciones rechazadas
- **WHEN** el Put fue aceptado sin llenarse y la orden de acciones es rechazada
- **THEN** se solicita la cancelación del Put y, si el broker la confirma, la API responde `400` con ambas órdenes y sin guardar la estrategia

#### Scenario: Pata ya ejecutada cuando falla otra
- **WHEN** el Put ya se ejecutó y falla la orden combinada de acciones y Call
- **THEN** el Put no se cierra, la estrategia se guarda como `PARTIALLY_EXECUTED` con el estado de cada orden y la API responde `409`

#### Scenario: Cancelación no confirmada
- **WHEN** el broker rechaza la cancelación de una pata aceptada
- **THEN** la estrategia se guarda como `PARTIALLY_EXECUTED`, se informa el rechazo de la cancelación y la API responde `409`

### Requirement: Estado de las órdenes sin autoaprobación

El estado de cada pata SHALL provenir de la respuesta de emisión del broker o de su libro de órdenes.

- Una pata que no aparezca en el libro de órdenes SHALL informarse como no verificada, no como confirmada.
- El sistema SHALL NOT asignar un estado predeterminado cuando el broker no lo informe.

#### Scenario: Orden ausente del libro de órdenes
- **WHEN** el broker devolvió un identificador pero la orden no aparece en la consulta posterior
- **THEN** la pata se informa con `verifiedInBroker: false` y con el estado reportado por el broker o `null`

### Requirement: Cantidades consistentes entre acciones y contratos

- **Auto-Collar**: SHALL requerir que `sharesCount` sea un múltiplo positivo de 100 (por defecto, 100) y SHALL comprar exactamente `contratos × 100` acciones en todos los brokers, para que cada Call vendido quede cubierto.
- **Protective Put**: SHALL usar `ceil(sharesCount / 100)` contratos.

Una cantidad inválida SHALL responder `400` antes de cotizar o emitir.

#### Scenario: Collar con una cantidad que no es múltiplo de 100
- **WHEN** se solicita un Auto-Collar con `sharesCount: 10`
- **THEN** la API responde `400` y no se emite ningún Call sin cobertura

### Requirement: Registro fiel de la cobertura

Para cada pata, las estrategias guardadas SHALL registrar:

- símbolo OCC, strike, vencimiento, cantidad y precio enviados;
- identificador de orden, estado reportado y cantidad ejecutada.

El símbolo OCC SHALL construirse con el vencimiento real del contrato. `POST /api/v1/hedging/collar-spread` SHALL exigir de forma explícita las primas de ambas patas y SHALL NOT asignar primas predeterminadas.

#### Scenario: Guardar un Protective Put ejecutado
- **WHEN** se ejecuta un Protective Put con un Put que vence el 2026-12-18
- **THEN** la pata guardada usa el símbolo OCC con vencimiento 261218, junto con el identificador y el estado devueltos por el broker

#### Scenario: Collar manual sin primas
- **WHEN** se registra un collar en `/hedging/collar-spread` sin `putPremium` o sin `callPremium`
- **THEN** la API responde `400`
