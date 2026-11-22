# Spec Delta

## ADDED Requirements

### Requirement: Control de orden en la tabla del Core 002

La pestaña «Tabla» de Fundamental (`002`) SHALL ofrecer un control segmentado con «Ranking Confluencia» por defecto y «Puntaje Fundamental». El primer modo SHALL respetar el `rank` global, mostrarlo como badge `#` con tooltip que aclare que es el puesto en la confluencia, y dejar las excluidas al final. El segundo SHALL ordenar por `score` del core con los `—` al final, sin recalcular el `rank`.

#### Scenario: Orden por defecto
- **GIVEN** hay candidatas y excluidas
- **WHEN** se abre la pestaña «Tabla» del Core 002
- **THEN** las candidatas aparecen por `rank` con badges `#`, las excluidas al final y «Ranking Confluencia» queda pulsado

#### Scenario: Cambio de orden
- **WHEN** se elige «Puntaje Fundamental»
- **THEN** las filas se ordenan por `score` del Core 002 de mayor a menor con los `—` al final y desaparecen los badges `#`

### Requirement: Filas escaneables en la tabla del Core 002

Las filas de la tabla del Core 002 SHALL sustituir el texto concatenado por badges y pills: `exclusionType` → etiqueta semántica, estado con punto indicador, puntaje tabular con `/100` o `—`, participación resumida y chips de veredicto, Altman, Piotroski y alerta de resultados (`UNVERIFIED`/`HIGH`). Las excluidas SHALL agruparse bajo un encabezado ligero con opacidad reducida y SHALL conservar el botón de evidencia por fila.

#### Scenario: Empresa excluida por veto
- **GIVEN** una empresa con `exclusionType: VIABILITY_VETO`
- **WHEN** se muestra su fila
- **THEN** aparece el badge «Veto GATE», no el sufijo «· excluida», la fila está atenuada bajo «Excluidas» y conserva su botón de evidencia

#### Scenario: Datos clave compactos
- **WHEN** se muestra una empresa evaluada
- **THEN** sus datos clave aparecen como chips separados de veredicto, Altman y Piotroski, con una alerta solo si el riesgo es `UNVERIFIED` o `HIGH`, sin la cadena `· Altman ... · Piotroski ...`

### Requirement: KPI cards del detalle del Core 002

Al desplegar la evidencia de una empresa en la pestaña «Tabla» de Fundamental (`002`), el modal SHALL mostrar ocho tarjetas en `grid-cols-2 md:grid-cols-4 gap-3`: viabilidad, valuación, riesgo de evento, próximos resultados, Altman Z-Score, Piotroski F-Score, ratio P/E y ejercicios fiscales. Los veredictos SHALL ser pills semánticas con `whitespace-nowrap`. El detalle SHALL NOT alterar ningún valor calculado por la API.

#### Scenario: Ocho métricas principales
- **WHEN** se abre la evidencia de una empresa evaluada
- **THEN** aparecen las ocho tarjetas con los valores informados por la API y sin texto concatenado

#### Scenario: Resultados sin verificar
- **GIVEN** un riesgo `UNVERIFIED` sin fecha de resultados
- **WHEN** se abre su evidencia
- **THEN** la pill es gris, se muestran «Earnings sin verificar» y la causa informada, y no se inventa una fecha

### Requirement: Tooltips explicativos en las KPI cards del Core 002

Cada una de las ocho etiquetas de las KPI cards del detalle SHALL ofrecer un popover propio al pasar el cursor o al enfocarla con teclado. El contenido SHALL ser una explicación general y breve del significado de la métrica, sin fórmulas, umbrales ni pills de estado. El popover SHALL usar `role="tooltip"`, `aria-describedby`, `cursor-help` y las clases `group-hover`/`group-focus-within`; SHALL NOT usar el atributo `title` nativo.

#### Scenario: Explicación de valuación
- **WHEN** se pasa el cursor sobre «Valuación» en el detalle
- **THEN** aparece «Da una idea de si la acción se ve cara, razonable o barata comparado con lo que la empresa gana y vende»

#### Scenario: Las ocho etiquetas
- **WHEN** se enfocan sucesivamente las etiquetas de las ocho KPI cards
- **THEN** cada una muestra su propia explicación general y el popover desaparece al perder el foco

### Requirement: Explicación de no seleccionar el Core 002

La pestaña «Cómo se calcula» de Fundamental (`002`) SHALL incluir una sección «Si no seleccionas el Core 002» con dos tarjetas, «Sigue pasando» y «Ya no pasa», que describan en lenguaje llano el efecto del checkbox. SHALL reutilizar los componentes `Seccion` y `Tarjeta` del panel, con cuatro frases por tarjeta, y SHALL NOT incluir claves técnicas ni fórmulas.

#### Scenario: Efecto de desmarcar el core
- **WHEN** se abre «Cómo se calcula» del Core 002
- **THEN** aparecen «Sigue pasando» y «Ya no pasa» con cuatro frases cada una y sin claves de la API

#### Scenario: Consulta y cálculo sin selección
- **GIVEN** el Core 002 desmarcado
- **WHEN** se lee la sección
- **THEN** explica que las fuentes se consultan y el core se calcula igual, que sigue vetando empresas sin salud financiera y que su puntaje, peso y efecto en el orden ya no aplican

### Requirement: Zona de Altman en el detalle

La zona de Altman SHALL derivarse de los umbrales `lower`/`upper` informados por la API, con las etiquetas «Zona Quiebra», «Zona Gris», «Zona Segura» o «Sin datos».

#### Scenario: Zona con datos reales
- **GIVEN** Altman 12.86 con umbrales 1.81/2.99
- **WHEN** se abre su evidencia
- **THEN** aparece «Zona Segura»

#### Scenario: Umbrales de no manufactura
- **GIVEN** Altman 0.9 con umbrales 1.1/2.6
- **WHEN** se abre su evidencia
- **THEN** aparece «Zona Quiebra» usando los umbrales informados, no los genéricos

### Requirement: Barra de Piotroski con tooltips por criterio

La barra SHALL tener nueve segmentos derivados de `piotroski.tests` y ordenados según el cálculo del backend. Cada segmento SHALL mostrar al hover un popover propio con el nombre del criterio, una pill de estado (`✓ Aprobada`, `✕ Reprobada`, `— Sin datos`) y una descripción de una línea; SHALL usar `cursor-help` y crecer verticalmente con `scale-y-125`, sin atributo `title` nativo.

#### Scenario: Orden y apariencia de los segmentos
- **GIVEN** Piotroski 4/8 con un criterio no evaluable
- **WHEN** se abre su evidencia
- **THEN** aparecen cuatro segmentos verdes, cuatro oscuros y uno punteado con borde de disposición

#### Scenario: Claves del cálculo
- **GIVEN** un objeto `piotroski.tests` con las claves del `fScore` del backend
- **WHEN** se renderiza la barra
- **THEN** el orden es `positiveRoa`, `positiveCashFlow`, `improvedRoa`, `operatingCashAboveIncome`, `reducedLongDebt`, `improvedCurrentRatio`, `nonDilutionProxy`, `improvedGrossMargin`, `improvedTurnover`

#### Scenario: Tooltip por criterio
- **GIVEN** `positiveRoa: true`, `improvedCurrentRatio: false` e `improvedTurnover: null`
- **WHEN** se pasa el cursor por los segmentos 1, 6 y 9
- **THEN** aparecen «1. ROA positivo ✓ Aprobada», «6. Mejor liquidez (Razón corriente) ✕ Reprobada» y «9. Mayor rotación de activos — Sin datos», cada uno con su descripción y sin tooltip nativo

### Requirement: Trazabilidad plegada del detalle del Core 002

Las líneas de auditoría SHALL estar en un acordeón colapsado por defecto titulado «Fuentes de datos: ...» con el control «Ver trazabilidad». Al expandirse SHALL mostrar referencias, timestamps ISO, CIK y ventanas exactas en `font-mono text-xs`.

#### Scenario: Fuentes resumidas
- **GIVEN** evidencia de SEC EDGAR, Alpaca IEX y Webull
- **WHEN** se abre la evidencia
- **THEN** el título es «Fuentes de datos: SEC EDGAR · Alpaca IEX · Webull» y las líneas completas no están visibles

#### Scenario: Auditoría expandida
- **WHEN** se pulsa «Ver trazabilidad»
- **THEN** aparecen las líneas completas con CIK, timestamps y ventanas en monoespacio

### Requirement: Dimensiones del modal de consulta del Core 002

El modal de Fundamental (`002`) SHALL usar `w-[95vw] max-w-6xl max-h-[90vh] flex flex-col`. El header y la barra de pestañas SHALL permanecer fijos arriba; solo el panel de contenido SHALL tener `overflow-y-auto`. La cabecera de la tabla SHALL colocar metadatos y control de orden en una misma fila (`flex items-center justify-between gap-4`).

#### Scenario: Modal ancho con controles fijos
- **WHEN** se abre la consulta del Core 002 en pantalla mediana o grande
- **THEN** el modal alcanza `max-w-6xl` y `90vh`, las pestañas no se desplazan con la tabla y el botón `>` de cada fila es visible

### Requirement: Badges sin cortes en la tabla del Core 002

Los badges y pills SHALL llevar `whitespace-nowrap`, la columna de acción SHALL tener ancho fijo `w-12 text-right pr-2` y los chips de «Datos clave» SHALL usar `flex flex-wrap items-center gap-1.5`, sin desbordamiento horizontal innecesario en escritorio.

#### Scenario: Varias pills en una fila
- **WHEN** una fila tiene estado, participación y varios chips
- **THEN** ninguno se parte en dos renglones y la columna de evidencia conserva su ancho

## MODIFIED Requirements

### Requirement: Consulta de resultados por core desde el selector

En el selector de cores, cada core SHALL ofrecer un botón, separado del checkbox y con tooltip y etiqueta accesible, que abra la consulta de ese core sin cambiar su selección. Esto incluye a Estrategia (`004`) y Confluencia (`007`), que no tienen checkbox. La consulta SHALL mostrar:

- una tabla con una fila por empresa evaluada, con estado, puntaje, participación y los datos clave del core. La participación indica si el core entró a la confluencia con su peso efectivo, si solo se calculó como filtro o dependencia, o si no se calculó. Cada fila SHALL permitir ver su evidencia. Para Fundamental (`002`), esa tabla SHALL seguir los requisitos visuales y de orden añadidos abajo;
- la explicación de cómo se calcula el core: fuentes, ventanas de datos, peso base y forma de participar. Para Fundamental (`002`), esa explicación SHALL ser visual y escaneable: tarjetas de fuentes y ventana, mini-tablas de semáforo con umbrales, chips de pruebas, badges de veredicto y riesgo, y un pie de dos columnas, sin párrafos técnicos densos;
- solo para Fundamental (`002`), un control de ayuda junto a «Cómo se calcula» que explique el efecto de seleccionarlo, con un panel que distinga «Seleccionado» de «No seleccionado». El control SHALL situarse fuera de la lista de pestañas, SHALL cerrarse con `Escape`, devolver el foco al control y conservar el modal abierto.

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

#### Scenario: Ayuda sobre la selección en Fundamental
- **WHEN** el usuario abre la consulta de Fundamental (`002`) y activa el control de ayuda
- **THEN** se abre un panel con «Seleccionado» y «No seleccionado» sin añadir una pestaña ni cambiar la rejilla de pestañas

#### Scenario: Cerrar la ayuda sin cerrar el modal
- **GIVEN** el panel de ayuda de Fundamental está abierto
- **WHEN** el usuario pulsa `Escape`
- **THEN** el panel se cierra, el modal sigue abierto y el foco vuelve al control de ayuda
