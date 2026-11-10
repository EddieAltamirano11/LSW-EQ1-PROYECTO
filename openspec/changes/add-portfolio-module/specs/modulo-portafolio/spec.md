# Módulo de Portafolio

## Purpose

Permitir consultar la cuenta y las posiciones del broker junto con las estrategias de cobertura guardadas, en una vista independiente del escáner que identifica el origen de cada dato.

## ADDED Requirements

### Requirement: Navegación al módulo de Portafolio

La sesión del cliente React SHALL ofrecer las pestañas «Dashboard» y «Portafolio». Al ingresar o restaurar la sesión, el dashboard SHALL ser la vista inicial. La pestaña «Portafolio» SHALL abrir un apartado propio de solo lectura y mantener disponible la acción «Salir». La navegación SHALL conservar la sesión, los destinos y el estado del escáner, y SHALL ser operable por teclado y puntero en móvil y escritorio, con foco visible y la pestaña activa identificable.

#### Scenario: Entrar y volver al escáner
- **WHEN** una persona abre «Portafolio» desde el dashboard con filtros y un activo seleccionados, y después vuelve a «Dashboard»
- **THEN** las consultas y tablas de Portafolio se limitan a su propia vista, y al volver se conservan los filtros, el activo y el modo de órdenes del escáner.

#### Scenario: Consultar desde móvil con teclado
- **WHEN** una persona usa el módulo con teclado en una pantalla de 360 px
- **THEN** puede cambiar de pestaña, consultar ambas secciones y alcanzar las acciones sin desplazamiento horizontal de la página.

### Requirement: Consultar la cuenta y las posiciones del broker seleccionado

Al abrir Portafolio, el cliente SHALL consultar `GET /api/v2/broker/account?strict=true` y `GET /api/v2/broker/positions?strict=true` con el token de la sesión y `x-broker-selection` correspondiente a Webull, Alpaca o IBKR. La sección «Broker» SHALL identificar el broker y mostrar el efectivo, el valor de cuenta, el poder de compra y la moneda que entregue el proveedor. El listado SHALL presentar cada posición abierta con el símbolo o identificador del instrumento, la cantidad y el lado cuando se conozca. Los valores ausentes SHALL aparecer como no disponibles y un cero confirmado SHALL aparecer como cero. La vista SHALL indicar cuándo la información viene de una cuenta de paper trading si el origen lo identifica.

#### Scenario: Mostrar una cuenta con posiciones abiertas
- **WHEN** el broker seleccionado confirma la cuenta y devuelve posiciones abiertas
- **THEN** la vista identifica el broker, muestra el resumen y conserva separadas las filas de cada posición, incluso si dos contratos comparten el símbolo subyacente.

#### Scenario: Mostrar saldo cero y cartera vacía
- **WHEN** el broker confirma efectivo cero y devuelve una lista de posiciones vacía
- **THEN** el módulo muestra el cero y un mensaje que indica que la cuenta carece de posiciones abiertas.

### Requirement: Contrato optativo de datos confirmados del broker

Con `strict=true`, los `GET /broker/account` y `GET /broker/positions` del enrutador compartido v1/v2 SHALL requerir un token Bearer válido y un `x-broker-selection` válido para Webull, Alpaca o IBKR. La cuenta SHALL responder `200` con `{ broker, account }` y un objeto que contiene `currency`, `cash`, `portfolioValue` y `buyingPower`, con `null` para campos sin dato confirmado y procedencia de la consulta cuando esté disponible. Las posiciones SHALL responder `200` con `{ broker, positions }` y un arreglo de posiciones confirmadas, vacío solo tras una lectura exitosa sin posiciones. Cada fila SHALL incluir un símbolo o identificador del instrumento y una cantidad finita. Ambas rutas SHALL devolver `401` ante una sesión ausente o inválida, `400` ante una selección ausente o inválida con sesión válida, `503` cuando el proveedor no esté disponible y `502` si su respuesta impide interpretar la consulta. La modalidad habitual de ambas rutas SHALL conservar su selección, autenticación, respuestas y respaldos existentes.

#### Scenario: Falla la consulta de cuenta
- **WHEN** una cuenta se solicita en modo estricto y la conexión con el proveedor falla
- **THEN** la respuesta es `503` con un error sin datos de cuenta simulados ni detalles internos de conexión.

#### Scenario: Falla el puente de posiciones
- **WHEN** el proveedor no está accesible y el puente entrega un arreglo vacío de respaldo
- **THEN** el modo estricto devuelve `503` y el cliente muestra «Posiciones no disponibles».

#### Scenario: Respuesta ilegible del proveedor
- **WHEN** la conexión responde pero entrega un formato que impide interpretar los datos solicitados
- **THEN** la consulta en modo estricto devuelve `502`.

#### Scenario: Peticiones inválidas y clientes existentes
- **WHEN** se solicita el modo estricto sin una sesión válida o con una selección inválida, y se repite la lectura con el contrato histórico
- **THEN** la consulta estricta responde con el `401` o `400` correspondiente, y la consulta histórica conserva su contrato.

### Requirement: Consultar coberturas guardadas en la base seleccionada

El cliente SHALL consumir `GET /api/v2/hedging` con el token y `x-database-selection` vigente, sin inferir un filtro por el broker o por el identificador de la cuenta. SHALL usar el arreglo JSON devuelto por el listado existente y mostrar el identificador del portafolio guardado, el símbolo, el tipo y el estado de cada cobertura. SHALL identificar MongoDB o Supabase como origen y presentar estas filas como registros de estrategia. Un arreglo vacío SHALL mostrar un estado sin coberturas y un error HTTP, de red o de formato SHALL mostrar que la consulta no está disponible.

#### Scenario: Mostrar coberturas de una base distinta a la del token
- **WHEN** el JWT se emitió con MongoDB pero la sesión seleccionó Supabase antes de abrir Portafolio
- **THEN** la consulta usa `x-database-selection: supabase` y muestra las filas de Supabase, con sus identificadores persistidos, aunque el broker seleccionado sea distinto del asociado a alguna fila.

#### Scenario: Distinguir una cobertura persistida de una posición
- **WHEN** una estrategia de cobertura guardada y una posición del broker comparten símbolo
- **THEN** cada una aparece en su sección y el módulo conserva el estado persistido de la estrategia sin deducir de él la ejecución de una orden.

### Requirement: Recuperación independiente y vigencia de consultas

Portafolio SHALL mostrar carga, resultado o error para cada consulta, ofrecer «Actualizar» mientras haya una sesión en línea y mantener visible la información válida de las demás consultas si una falla. SHALL descartar resultados pendientes de una actualización anterior, de otros destinos o de una sesión cerrada. Si la sesión es de demostración sin conexión, SHALL mostrar un aviso de que se necesita iniciar sesión con el servidor para consultar los datos. Ante un `401` SHALL informar que se requiere una sesión válida.

#### Scenario: Mostrar un resultado parcial
- **WHEN** la cuenta y las coberturas responden correctamente pero la consulta de posiciones falla
- **THEN** la cuenta y las coberturas permanecen visibles, las posiciones muestran su error y se puede actualizar el módulo.

#### Scenario: Respuesta de un contexto anterior
- **WHEN** una persona sale de Portafolio y cambia de broker o de base antes de abrirlo de nuevo, o cierra la sesión durante una lectura
- **THEN** las respuestas anteriores no aparecen en la vista ni sustituyen datos del contexto vigente.

#### Scenario: Abrir Portafolio en la demostración sin conexión
- **WHEN** se abre la pestaña desde «Acceso Rápido Demo» sin una sesión en línea
- **THEN** la vista explica cómo obtener acceso a los datos y no muestra saldos, posiciones ni coberturas de ejemplo.
