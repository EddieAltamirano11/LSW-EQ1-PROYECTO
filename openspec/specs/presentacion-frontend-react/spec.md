# presentacion-frontend-react Specification

## Purpose

Unificar la identidad visual del acceso y del panel de coberturas de Los Eddies y mantener sus controles accesibles en escritorio y móvil con la funcionalidad vigente.

## Requirements

### Requirement: Identidad visual y disposición adaptable

El frontend React SHALL implementar la arquitectura de **Santo Grial (3 Columnas)** para pantallas de escritorio (>= 1024px) y apilamiento secuencial accesible para dispositivos móviles (< 1024px). El diseño SHALL aprovechar de forma fluida el ancho horizontal completo de la pantalla sin márgenes laterales ociosos, otorgando prioridad espacial a la columna central (núcleo cuantitativo y gráfico), asignando un ancho equilibrado y cómodo a las columnas laterales (izquierda y derecha), y delimitando **un único ranking consolidado** en la parte inferior central.

El diseño SHALL conservar estrictamente la paleta de colores institucional actual: verde bosque (`--ui-green`: `#254d38` / `#193b2d`), superficies y tarjetas claras (`--ui-bg`, `--ui-panel`, `--ui-card`), acentos suaves (`--ui-soft`), tipografía de alto contraste (`--ui-ink`) y bordes refinados (`--ui-border`).

En la columna derecha (Terminal de Ejecución Bursátil), las pestañas selectoras de operación bursátil (Auto-Collar, Protective Put y Acciones) SHALL implementar un estado activo de alto contraste visual con sombreado nítido (`bg-[var(--ui-green)] text-white shadow-md ring-2`) que distinga de forma inequívoca la opción seleccionada frente a las inactivas.

Queda terminantemente prohibido el uso de caracteres emoji en la interfaz gráfica; todos los indicadores, estados, botones y acciones SHALL utilizar exclusivamente iconos vectoriales SVG de **Lucide React (`lucide-react`)**.

La interfaz SHALL ofrecer etiquetas legibles, foco visible y acceso por teclado a los controles. Las vistas SHALL ajustarse al ancho de pantalla y permitir el desplazamiento dentro de una sección de datos cuando sea necesario, manteniendo a la vista las acciones correspondientes.

#### Scenario: Usar el cliente en escritorio con disposición Santo Grial
- **WHEN** se presenta el acceso o el panel React en un ancho de escritorio (>= 1024 px)
- **THEN** la interfaz se organiza en tres columnas fluidas de ancho completo:
  1. Columna Izquierda (320px - 330px): Motores cuantitativos, selectores de Cores (1 a 5), filtros de DTE, ordenamiento y buscador dinámico de tickers, sin duplicar listas de empresas.
  2. Columna Central (1fr expandida): Núcleo de análisis con gráfico TradingView en vivo arriba y el **único ranking cuantitativo multicriterio** abajo enriquecido con los badges de los cores.
  3. Columna Derecha (380px - 390px): Terminal de ejecución bursátil con selector de estrategia en alto contraste visual y ticket de orden hacia el broker activo.
  Los controles usan exclusivamente iconos de `lucide-react` y la paleta verde bosque institucional.

#### Scenario: Usar el cliente en móvil
- **WHEN** se presenta una vista React en un ancho de 360 px
- **THEN** los formularios, los filtros y las acciones se pueden leer y alcanzar mediante apilamiento secuencial fluido sin desplazamiento horizontal de la página, y los modales mantienen accesibles sus controles.

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

### Requirement: Presentación de órdenes directas a Broker y de la respuesta

El panel SHALL operar exclusivamente en modo de ejecución real hacia el broker seleccionado y enviar siempre `executeOrders: true`. Queda descartado el modo simulado u órdenes virtuales. La terminal de ejecución bursátil SHALL ofrecer tres operaciones directas hacia el broker activo (Webull, Alpaca o IBKR):

1. **Auto-Collar Spread:** Estructura y emite la cobertura combinada de 3 patas (100 acciones subyacentes + compra de Put protector + venta de Call cubierta).
2. **Protective Put:** Estructura y emite la cobertura de suelo blindado (compra de contrato Put para cobertura contra caídas, con opción de cobertura de cartera o compra de acciones + Put).
3. **Compra / Venta de Acciones (Equity):** Emite órdenes bursátiles directas de mercado o límite para el subyacente seleccionado sin derivados.

El botón de confirmación de cada operación SHALL mostrar «Emitir a Broker (LIVE)» con icono Lucide, aviso de confirmación y el estado de la transacción real. El modal de respuesta SHALL presentar los datos y estados reales que recibe del microservicio y del broker, incluidos el código HTTP, el contexto, el mensaje, las patas de cobertura o de equity, las métricas y el listado de órdenes procesadas por el matching engine. SHALL conservar la expansión, ocultación y copia del JSON con su indicador actual de copia y los controles de cierre.

#### Scenario: Emitir orden directa a Broker (Auto-Collar, Protective Put o Acciones)
- **WHEN** el usuario confirma la emisión de cualquiera de las tres estrategias bursátiles desde la terminal derecha
- **THEN** la solicitud se envía con `executeOrders: true` hacia el broker activo (Webull, Alpaca o IBKR), reportando el resultado real de la emisión sin estados simulados.

#### Scenario: Presentar el detalle de respuesta
- **WHEN** la aplicación muestra el modal de respuesta en su flujo vigente
- **THEN** el resultado, su contexto y los datos disponibles se distinguen visualmente, se conserva la condición que muestra la tabla de órdenes y se puede acceder a las acciones de JSON y cierre.

### Requirement: Compatibilidad de la interfaz con los flujos vigentes

El rediseño SHALL conservar los valores por defecto, las validaciones, los estados y las condiciones de visibilidad de los controles de los flujos vigentes. SHALL mantener las rutas de la aplicación y las solicitudes vigentes de autenticación, escaneo y ejecución, con los mismos métodos, parámetros, headers, payloads, respaldos y tratamiento de respuestas y errores. SHALL preservar el almacenamiento de sesión y la integración de TradingView.

#### Scenario: Revisar los consumidores después del rediseño
- **WHEN** se compara el código del cliente con la versión anterior
- **THEN** los flujos existentes conservan sus entradas y salidas, los contratos de API y el vínculo de cada acción con su comportamiento actual.
