# Spec Delta

## Purpose

Define la explicación verificable del cálculo del Core 002 y del efecto de seleccionarlo, para que el usuario distinga viabilidad, riesgo por resultados y participación en la confluencia sin cambiar el cálculo real.

## ADDED Requirements

### Requirement: Explicación visual del cálculo del Core 002

La consulta de «Cómo se calcula» del Core 002 SHALL presentar la explicación como componentes visuales escaneables —tarjetas, badges de color, mini-tablas y listas cortas—, sin fórmulas extensas, códigos SIC ni párrafos técnicos densos. La cabecera SHALL mostrar las fuentes y la ventana de dos ejercicios fiscales; el pie SHALL mostrar peso y regla GATE en dos columnas.

#### Scenario: Usuario abre la explicación del Core 002 antes de evaluar

- **WHEN** el usuario abre el modal del Core 002 sin resultados evaluados
- **THEN** la pestaña «Cómo se calcula» muestra las tarjetas de fuentes y ventana, los componentes de umbrales y pruebas, y el aviso de que debe evaluar para ver resultados

### Requirement: Umbrales y pruebas en la explicación del Core 002

La explicación SHALL mostrar los umbrales de Altman en dos mini-tablas de semáforo (manufactura `1.81`/`2.99`, no manufactura `1.10`/`2.60`) y una nota breve para financieras sin cálculo Z. SHALL mostrar las nueve pruebas de Piotroski como chips compactos con mínimo 6 datos válidos y aporte del 20 %, además de los cuatro veredictos y los cuatro niveles de riesgo.

#### Scenario: Explicación sin bandeos inventados

- **WHEN** se muestra la explicación del F-Score
- **THEN** no aparece una clasificación 0–3 / 4–6 / 7–9 ni cualquier otro bandeo no implementado; cualquier barra segmentada representa las nueve pruebas y su aporte se describe como `aprobadas/evaluables` dentro del 20 % del puntaje

### Requirement: Distinción entre viabilidad y riesgo por resultados

La explicación SHALL separar la clasificación de viabilidad (`VIABLE`, `MARGINAL`, `NO_VIABLE`, `UNKNOWN`) del riesgo por cercanía a resultados (`HIGH` a 7 días o menos, `MEDIUM` hasta 30, `LOW` después, `UNVERIFIED` sin fecha) y SHALL indicar que el riesgo no modifica el puntaje. SHALL además aclarar que las velas OHLC pertenecen al Core 001 y no intervienen en el Core 002.

#### Scenario: Usuario consulta el riesgo sin fecha verificable

- **WHEN** la explicación describe el riesgo `UNVERIFIED`
- **THEN** indica que el puntaje se conserva y el core queda parcial, sin atribuir fecha alguna al proveedor

#### Scenario: Usuario busca el origen de las velas

- **WHEN** se lee la explicación del Core 002
- **THEN** el texto establece explícitamente que sus datos son estados financieros anuales y la fecha de resultados, no velas OHLC

### Requirement: Efecto de la selección del Core 002

La explicación SHALL indicar que el Core 002 siempre se calcula y actúa como filtro de viabilidad (`GATE`) aunque no esté seleccionado, vetando `MARGINAL` y `NO_VIABLE` sin consultar su collar; solo cuando está seleccionado su puntaje entra a la confluencia con peso base 20 (25 % efectivo con los cinco cores activos).

#### Scenario: Core 002 desmarcado

- **WHEN** el usuario lee la explicación de participación con el Core 002 desmarcado
- **THEN** el texto indica que el core se calcula igual, sigue vetando empresas no viables y no suma puntaje a la confluencia

#### Scenario: Core 002 marcado

- **WHEN** el usuario lee la explicación de peso con el Core 002 marcado
- **THEN** el texto indica que aporta su puntaje con peso base 20 y que, con los cinco cores activos, ese peso equivale al 25 % efectivo

### Requirement: Panel de ayuda sobre la selección del Core 002

La consulta del Core 002 SHALL ofrecer un control de ayuda con icono `?` de Lucide React y etiqueta accesible «Qué significa seleccionar el Core 002», que abra un panel con los bloques «Seleccionado» y «No seleccionado». El panel SHALL cerrarse con `Escape` y devolver el foco al control. El control SHALL estar fuera de la lista de pestañas y SHALL NO modificarse en los demás cores.

#### Scenario: Usuario abre el panel de ayuda del Core 002

- **WHEN** el usuario activa el control de ayuda en el modal del Core 002
- **THEN** se muestra un panel con los dos bloques y el foco queda dentro del panel

#### Scenario: Usuario cierra el panel con Escape

- **WHEN** el panel está abierto y el usuario pulsa `Escape`
- **THEN** se cierra solo el panel, el modal permanece abierto y el foco vuelve al control de ayuda

#### Scenario: Otro core no muestra el control

- **WHEN** el usuario abre el modal de cualquier core distinto de `002`
- **THEN** no aparece el control de ayuda ni el panel, y la barra de pestañas conserva su composición
