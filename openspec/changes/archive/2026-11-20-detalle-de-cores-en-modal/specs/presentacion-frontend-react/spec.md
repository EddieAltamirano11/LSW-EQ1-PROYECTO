# Spec Delta

## ADDED Requirements

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
