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

### Requirement: Consulta de resultados por core desde el selector

En el selector de cores, cada core SHALL ofrecer un botón, separado del checkbox y con tooltip y etiqueta accesible, que abra la consulta de ese core sin cambiar su selección. Esto incluye a Estrategia (`004`) y Confluencia (`007`), que no tienen checkbox. La consulta SHALL mostrar:

- una tabla con una fila por empresa evaluada, con estado, puntaje, participación y los datos clave del core. La participación indica si el core entró a la confluencia con su peso efectivo, si solo se calculó como filtro o dependencia, o si no se calculó. Cada fila SHALL permitir ver su evidencia;
- la explicación de cómo se calcula el core: fuentes, ventanas de datos, peso base y forma de participar.

Antes de evaluar los cores, SHALL mostrar solo la explicación e indicar que hay que evaluar para ver resultados. Estos detalles SHALL NOT agregar columnas ni secciones permanentes al ranking.

#### Scenario: Abrir los resultados de Técnico
- **GIVEN** se evaluaron los cores
- **WHEN** el usuario pulsa el botón de Técnico
- **THEN** se abre la consulta con una fila por empresa con tendencia, puntaje y participación, y la selección de cores no cambia

#### Scenario: Antes de evaluar
- **WHEN** el usuario pulsa el botón de un core sin haber evaluado
- **THEN** se muestra cómo se calcula el core y el aviso de evaluar para ver resultados

#### Scenario: Core que solo se calculó
- **GIVEN** Fundamental no está seleccionado y se evaluaron los cores
- **WHEN** el usuario abre su consulta
- **THEN** cada empresa indica que Fundamental se calculó como filtro de viabilidad y no entró a la confluencia

#### Scenario: Estrategia sin checkbox
- **WHEN** el usuario abre la consulta de Estrategia (`004`)
- **THEN** ve el collar de cada empresa o el motivo por el que no tiene collar

### Requirement: Gráficas de los cores en la consulta por core

La consulta de Técnico (`001`), Estrategia (`004`) y Confluencia (`007`) SHALL incluir una pestaña de gráfica para la empresa seleccionada en su tabla:

- **`001`**: velas de dos años con bandas de soporte y resistencia, tramos de tendencia, medias móviles y la ventana proyectada, rotulada como proyección.
- **`004`**: ganancia o pérdida del collar al vencimiento según el precio del subyacente, con strikes, punto de equilibrio, pérdida máxima y ganancia máxima.
- **`007`**: contribución de cada core al puntaje (peso efectivo por puntaje) y los conflictos.

Cada gráfica SHALL tener un resumen en texto accesible. Si faltan datos, SHALL mostrar la causa en lugar de una gráfica vacía o con valores supuestos. Las gráficas SHALL cargarse solo al abrir su pestaña.

#### Scenario: Gráfica técnica
- **GIVEN** se evaluaron los cores
- **WHEN** el usuario abre la pestaña Gráfica de Técnico con AAPL seleccionada
- **THEN** ve las velas de dos años con niveles, tramos y la ventana proyectada rotulada como proyección

#### Scenario: Payoff del collar
- **GIVEN** el Core 004 tiene un collar para AAPL
- **WHEN** el usuario abre la gráfica de Estrategia
- **THEN** ve el payoff con strikes, breakeven, pérdida máxima y ganancia máxima, y esos valores coinciden con la tabla

#### Scenario: Contribución a la confluencia
- **GIVEN** la confluencia de AAPL usó cinco cores
- **WHEN** el usuario abre la gráfica de Confluencia
- **THEN** ve la contribución de cada core, y la suma de las contribuciones coincide con el puntaje

#### Scenario: Sin datos para la gráfica
- **WHEN** el Core 001 no tiene datos para la empresa seleccionada
- **THEN** la pestaña muestra la causa

### Requirement: Vista técnica en la columna central

La columna central SHALL ofrecer un selector entre «TradingView» y «Core técnico».

- **TradingView** SHALL ser la vista por defecto y conservar su comportamiento actual.
- **Core técnico** SHALL mostrar, para el activo seleccionado, la gráfica del Core 001: velas diarias de dos años, bandas de soporte y resistencia, tramos de tendencia, medias móviles y la ventana proyectada, rotulada como proyección. SHALL incluir un resumen en texto accesible.
- Esta vista SHALL NOT requerir que se hayan evaluado los cores.
- Al cambiar el activo seleccionado, la vista SHALL actualizarse a ese activo.
- Si faltan datos del Core 001, SHALL mostrar la causa y permitir volver a TradingView.

#### Scenario: Vista por defecto
- **WHEN** se abre el panel
- **THEN** la columna central muestra TradingView como hasta ahora

#### Scenario: Cambiar a la vista Core técnico
- **GIVEN** AAPL es el activo seleccionado
- **WHEN** el usuario elige «Core técnico»
- **THEN** ve las velas de AAPL con soportes, resistencias, tramos de tendencia y la ventana proyectada

#### Scenario: Cambiar de activo con la vista técnica abierta
- **GIVEN** la columna central muestra la vista Core técnico
- **WHEN** el usuario selecciona MSFT en el ranking
- **THEN** la gráfica pasa a mostrar MSFT

#### Scenario: Sin datos del Core 001
- **WHEN** el Core 001 no tiene datos del activo seleccionado
- **THEN** la vista muestra la causa y permite volver a TradingView

### Requirement: Collar del Core 004 en el ranking

Cuando exista resultado de cores, el ranking SHALL mostrar en las columnas de Put, Call, Prima Neta y Retorno Máx. el collar del Core 004 de cada empresa apta:

- strike y vencimiento de cada contrato;
- prima observada de cada contrato;
- costo neto expresado como débito o crédito;
- retorno máximo;
- la marca «Real · Core 004» y la hora de cotización.

Sin resultado de cores, o en filas sin collar del Core 004, esas columnas SHALL mostrar los valores del escáner identificados como teóricos. En las filas con collar real, la columna de probabilidad SHALL indicar que la probabilidad teórica no aplica a ese collar. La columna de cores SHALL distinguir el veto de viabilidad, la falta de collar líquido y los datos insuficientes, y mostrar la causa. El ranking SHALL conservar sus columnas actuales.

#### Scenario: Empresa con collar real
- **GIVEN** se evaluaron los cores y AAPL tiene collar del Core 004
- **WHEN** se muestra el ranking
- **THEN** la fila de AAPL muestra los contratos, primas, costo neto y retorno del Core 004 con la marca «Real · Core 004», y su probabilidad indica que no aplica

#### Scenario: Antes de evaluar los cores
- **WHEN** el ranking se muestra sin resultado de cores
- **THEN** las columnas de collar muestran los valores del escáner identificados como teóricos

#### Scenario: Empresa excluida sin collar
- **GIVEN** una empresa excluida por falta de collar líquido
- **WHEN** se muestra el ranking
- **THEN** la columna de cores indica «Sin collar líquido» con la causa, no un veto

### Requirement: Riesgo de earnings sin verificar en la consulta por core

Cuando la API informe el riesgo de eventos como `UNVERIFIED`, la consulta por core de Fundamental (`002`) y de Señales directas (`003`) SHALL mostrar «Earnings sin verificar» junto con la causa, y SHALL NOT mostrar una fecha de resultados.

#### Scenario: Riesgo de earnings sin verificar
- **GIVEN** la API de cores devuelve el riesgo de eventos `UNVERIFIED` para AAPL
- **WHEN** el usuario abre la consulta de Fundamental
- **THEN** la fila de AAPL muestra «Earnings sin verificar» con la causa y sin fecha de resultados

### Requirement: Identificación de valores teóricos del escáner

El ranking, la boleta y el modal de respuesta SHALL identificar como teóricas (Black-Scholes) las primas, métricas y probabilidades que provienen del escáner, y SHALL NOT presentarlas como cotizaciones de mercado.

#### Scenario: Prima teórica en el ranking
- **WHEN** el ranking muestra las primas de Put y Call de un candidato con valores del escáner
- **THEN** las primas aparecen rotuladas como teóricas

#### Scenario: Prima teórica en el modal de respuesta
- **WHEN** el modal de respuesta muestra una prima que proviene del escáner
- **THEN** la prima aparece rotulada como teórica

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
