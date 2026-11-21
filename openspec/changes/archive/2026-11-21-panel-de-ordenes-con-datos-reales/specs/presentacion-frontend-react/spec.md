# Spec Delta

## MODIFIED Requirements

### Requirement: Presentación de órdenes directas a Broker y de la respuesta

El panel SHALL operar exclusivamente en modo de ejecución real hacia el broker seleccionado y enviar siempre `executeOrders: true`. Queda descartado el modo simulado u órdenes virtuales. La terminal de ejecución bursátil SHALL ofrecer tres operaciones directas hacia el broker activo (Webull, Alpaca o IBKR):

1. **Auto-Collar Spread:** Estructura y emite la cobertura combinada de 3 patas (100 acciones subyacentes + compra de Put protector + venta de Call cubierta).
2. **Protective Put:** Estructura y emite la cobertura de suelo blindado (compra de contrato Put para cobertura contra caídas, con opción de cobertura de cartera o compra de acciones + Put).
3. **Compra / Venta de Acciones (Equity):** Emite órdenes bursátiles directas de mercado o límite para el subyacente seleccionado sin derivados.

**Vista previa**: antes de emitir un Auto-Collar o un Protective Put, la terminal SHALL mostrar la vista previa que devuelve el backend, con los contratos, strikes, vencimiento y primas observadas, su instante y su fuente.
- En el Auto-Collar, la vista previa SHALL ser el collar del Core 004 que muestra el ranking para el activo seleccionado; si el activo no lo tiene, SHALL ser la que calcula el backend con las mismas reglas. La estructura SHALL rotularse «Collar», con su costo neto.
- Si la vista previa no está disponible, SHALL explicar la causa y deshabilitar la emisión de esa cobertura.
- Cuando el activo no tenga datos, la terminal SHALL NOT mostrar ni enviar primas, strikes, métricas ni probabilidades inventadas.

**Confirmación y avisos**: el botón de confirmación de cada operación SHALL mostrar «Emitir a Broker (LIVE)» con icono Lucide, aviso de confirmación y el estado de la transacción real. Los avisos de éxito SHALL construirse con las órdenes, contratos y cantidades que devuelve la API.

**Modal de respuesta**: SHALL presentar los datos y estados reales que recibe del microservicio y del broker, incluidos el código HTTP, el contexto, el mensaje, las patas de cobertura o de equity, las métricas y el listado de órdenes procesadas por el matching engine.
- Ante una ejecución parcial (`409`), SHALL destacar el estado `PARTIALLY_EXECUTED` y el estado de cada orden.
- SHALL conservar la expansión, ocultación y copia del JSON con su indicador actual de copia y los controles de cierre.

#### Scenario: Emitir orden directa a Broker (Auto-Collar, Protective Put o Acciones)
- **WHEN** el usuario confirma la emisión de cualquiera de las tres estrategias bursátiles desde la terminal derecha
- **THEN** la solicitud se envía con `executeOrders: true` hacia el broker activo (Webull, Alpaca o IBKR), reportando el resultado real de la emisión sin estados simulados.

#### Scenario: Presentar el detalle de respuesta
- **WHEN** la aplicación muestra el modal de respuesta en su flujo vigente
- **THEN** el resultado, su contexto y los datos disponibles se distinguen visualmente, se conserva la condición que muestra la tabla de órdenes y se puede acceder a las acciones de JSON y cierre.

#### Scenario: Previsualizar antes de emitir una cobertura
- **WHEN** el usuario selecciona Protective Put para un activo
- **THEN** la terminal muestra el contrato Put real con su prima observada, su instante y su fuente antes de habilitar la emisión

#### Scenario: Auto-Collar con el collar del ranking
- **GIVEN** el ranking muestra el collar del Core 004 de AAPL
- **WHEN** el usuario selecciona AAPL y abre el Auto-Collar en la terminal derecha
- **THEN** la terminal muestra esos mismos contratos, rotulados «Collar» con su costo neto, y al emitir los envía para que se coticen de nuevo

#### Scenario: Activo sin datos de cobertura
- **WHEN** el activo seleccionado no figura en el ranking y la vista previa no devuelve contratos
- **THEN** la terminal informa la causa, deshabilita Auto-Collar y Protective Put y no muestra primas ni probabilidades

#### Scenario: Aviso de éxito con datos de la respuesta
- **WHEN** el broker acepta un Auto-Collar
- **THEN** el aviso indica la cantidad de órdenes y los strikes devueltos por la API, no los del escáner

#### Scenario: Ejecución parcial
- **WHEN** la API responde `409` a una cobertura
- **THEN** el modal muestra el estado `PARTIALLY_EXECUTED` y cada orden con su estado y su cantidad ejecutada

### Requirement: Compatibilidad de la interfaz con los flujos vigentes

El rediseño SHALL conservar los valores por defecto, las validaciones, los estados y las condiciones de visibilidad de los controles de los flujos vigentes. SHALL mantener las rutas de la aplicación y las solicitudes vigentes de autenticación, escaneo y ejecución, con los mismos métodos, parámetros, headers, payloads, respaldos y tratamiento de respuestas y errores.

Quedan exceptuados los cambios que exigen otros requisitos de esta especificación:
- la vista previa real antes de emitir una cobertura;
- el envío del contrato elegido en el Protective Put;
- la eliminación de los respaldos que inventan datos o repiten solicitudes.

SHALL preservar el almacenamiento de sesión y la integración de TradingView.

#### Scenario: Revisar los consumidores después del rediseño
- **WHEN** se compara el código del cliente con la versión anterior
- **THEN** los flujos existentes conservan sus entradas y salidas, los contratos de API y el vínculo de cada acción con su comportamiento actual, salvo los cambios documentados por los requisitos de órdenes y de solicitudes sin reintentos.

## ADDED Requirements

### Requirement: Solicitudes sin reintentos que alteren la operación

El panel SHALL NOT reintentar automáticamente una solicitud cambiando sus parámetros, su contenido o la versión de la API.

- Si una consulta de cores falla, el panel SHALL mostrar el error devuelto, sin repetir la consulta con otro `limit` ni sin `extraSymbols`.
- Una emisión de órdenes SHALL enviarse una sola vez a la versión de API configurada. Ante un error de red, el panel SHALL informar que el resultado es desconocido y sugerir revisar las órdenes en el broker antes de reintentar.

#### Scenario: Error de validación en la consulta de cores
- **WHEN** la API de cores responde `400` a una consulta con tickers añadidos
- **THEN** el panel muestra el error y no muestra resultados de una consulta sin esos tickers

#### Scenario: Error de red al emitir un Auto-Collar
- **WHEN** la conexión falla mientras se envía un Auto-Collar
- **THEN** el panel no reenvía la solicitud a otra versión de la API e indica revisar las órdenes en el broker
