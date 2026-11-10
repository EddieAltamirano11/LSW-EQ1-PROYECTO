# presentacion-frontend-react Specification

## Purpose

Unificar la identidad visual del acceso y del panel de coberturas de Los Eddies y mantener sus controles accesibles en escritorio y móvil con la funcionalidad vigente.

## Requirements

### Requirement: Identidad visual y disposición adaptable

El frontend React SHALL usar el verde bosque y las superficies claras del login público como referencia visual en el acceso, el panel, los formularios, los filtros, las tablas, los botones y los modales. La interfaz SHALL ofrecer etiquetas legibles, foco visible y acceso por teclado a los controles. Las vistas SHALL ajustarse al ancho de pantalla y permitir el desplazamiento dentro de una sección de datos cuando sea necesario, manteniendo a la vista las acciones correspondientes.

#### Scenario: Usar el cliente en escritorio
- **WHEN** se presenta el acceso o el panel React en un ancho de 1280 px
- **THEN** los encabezados, superficies, controles y modales comparten la identidad verde y clara, con estados diferenciados por texto y tratamiento visual.

#### Scenario: Usar el cliente en móvil
- **WHEN** se presenta una vista React en un ancho de 360 px
- **THEN** los formularios, los filtros y las acciones se pueden leer y alcanzar sin desplazamiento horizontal de la página, y los modales mantienen accesibles sus controles.

### Requirement: Presentación del acceso y de la sesión

El acceso React SHALL presentar usuario, contraseña, MongoDB y Supabase, IBKR, Alpaca y Webull, y el envío del formulario con sus valores iniciales, validaciones y estado de carga vigentes. Los ajustes SHALL mantener el campo de URL y los presets Render Cloud y Local (3050). El estado de error SHALL conservar el mensaje y las acciones «Apuntar a Render Cloud» y «Acceso Rápido Demo». El panel SHALL presentar la base y el broker de la sesión y la acción Salir.

#### Scenario: Mostrar el formulario de acceso
- **WHEN** el cliente React se abre sin una sesión restaurada
- **THEN** muestra los campos y selectores con MongoDB y Webull seleccionados inicialmente y permite desplegar los ajustes de servidor.

#### Scenario: Presentar un error de acceso existente
- **WHEN** el flujo de acceso vigente llega a su estado de error
- **THEN** el mensaje y las dos acciones de recuperación aparecen juntos, y se puede volver a usar el formulario.

#### Scenario: Mostrar el contexto del panel
- **WHEN** el cliente React muestra el panel para una sesión
- **THEN** la cabecera identifica su base y broker y ofrece el mismo control para salir y volver al acceso.

### Requirement: Presentación del escáner, el ranking y TradingView

El panel SHALL conservar la acción de escaneo, los filtros Top 5 y Top 10, los criterios de probabilidad, prima neta y retorno, y los vencimientos de 30, 45 y 60 días. SHALL mostrar los estados existentes de carga y sin resultados. El ranking SHALL conservar posición, empresa y ticker, mercado, precio spot, tendencia, datos de Put y Call, prima neta, probabilidad, sweet spot, retorno y acciones por candidato. SHALL permitir seleccionar el activo con un clic en la fila o al activar su ticker con el teclado, y conservar los widgets de gráfico y diagnóstico y el enlace externo al símbolo seleccionado.

#### Scenario: Presentar los filtros iniciales
- **WHEN** el escáner se muestra por primera vez en el panel
- **THEN** los valores iniciales visibles son Top 5, probabilidad y 45 días, y se mantienen disponibles los demás valores y la acción de escaneo.

#### Scenario: Consultar un candidato en pantalla estrecha
- **WHEN** el ranking contiene candidatos y se muestra en móvil
- **THEN** el ticker seleccionable, los datos y la acción de orden de cada candidato se pueden localizar sin desplazar lateralmente la página.

#### Scenario: Mostrar el análisis del activo
- **WHEN** se hace clic en una fila del ranking o se activa el ticker del candidato con el teclado
- **THEN** el gráfico, el análisis técnico y el enlace externo corresponden a ese símbolo y mantienen sus opciones actuales.

#### Scenario: Consultar criterios
- **WHEN** se abre el modal desde «¿Qué debe cumplir una empresa?»
- **THEN** aparecen los cuatro pilares con sus umbrales y explicaciones, y están disponibles la X y «Entendido y Validado».

### Requirement: Presentación de los modos de órdenes y de la respuesta

El panel SHALL iniciar en modo Real y concentrar la indicación y el cambio de modo en el selector «Órdenes». SHALL conservar la acción por candidato según el modo y el aviso de resultado con su cierre. El modal SHALL presentar los datos y estados que recibe actualmente, incluidos el código HTTP, el contexto, el mensaje, las patas, las métricas y, cuando corresponda, el listado de órdenes. SHALL conservar la expansión, ocultación y copia del JSON con su indicador actual de copia y los dos controles de cierre.

#### Scenario: Identificar el modo de órdenes
- **WHEN** se presenta el panel en su estado inicial o en el modo Simulado existente
- **THEN** el selector «Órdenes» muestra el modo activo con texto y permite cambiar entre Real y Simulado, y la acción de cada fila conserva la etiqueta correspondiente, «Emitir a Broker» o «Ejecutar».

#### Scenario: Presentar el detalle de respuesta
- **WHEN** la aplicación muestra el modal de respuesta en su flujo vigente
- **THEN** el resultado, su contexto y los datos disponibles se distinguen visualmente, se conserva la condición que muestra la tabla de órdenes y se puede acceder a las acciones de JSON y cierre.

### Requirement: Compatibilidad de la interfaz con los flujos vigentes

El rediseño SHALL conservar los valores por defecto, las validaciones, los estados y las condiciones de visibilidad de los controles de los flujos vigentes. SHALL mantener las rutas de la aplicación y las solicitudes vigentes de autenticación, escaneo y ejecución, con los mismos métodos, parámetros, headers, payloads, respaldos y tratamiento de respuestas y errores. SHALL preservar el almacenamiento de sesión y la integración de TradingView.

#### Scenario: Revisar los consumidores después del rediseño
- **WHEN** se compara el código del cliente con la versión anterior
- **THEN** los flujos existentes conservan sus entradas y salidas, los contratos de API y el vínculo de cada acción con su comportamiento actual.
