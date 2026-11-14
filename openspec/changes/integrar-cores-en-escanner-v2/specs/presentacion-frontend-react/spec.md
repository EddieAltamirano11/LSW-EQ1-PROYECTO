# Spec Delta

## ADDED Requirements

### Requirement: Selección de cores en el escáner v2

El panel React SHALL ofrecer junto a los filtros existentes una vista de ranking por cores. El usuario SHALL poder elegir de forma individual o combinada Técnico, Fundamental, Señales directas, Institucional y Noticias, con al menos una fuente seleccionada para consultar. La vista SHALL usar la respuesta de la API v2 de análisis para mostrar posición, puntaje y modalidad individual o de confluencia. El detalle por activo SHALL permitir consultar los indicadores, evidencia, fuente, fecha y disponibilidad de cada Core participante. También SHALL mostrar la evaluación de Collar Spread, la confluencia cuando corresponda y el estado de los cores no seleccionados.

#### Scenario: Cambiar el conjunto de fuentes
- **WHEN** el usuario consulta con Técnico y luego activa Noticias
- **THEN** el panel consulta la API con ambas fuentes, muestra el orden devuelto y permite revisar los dos aportes y los pesos efectivos

#### Scenario: Inspeccionar una evaluación de Collar Spread
- **WHEN** el usuario abre el detalle de un candidato del ranking por cores
- **THEN** el panel muestra los diagnósticos disponibles, la evaluación de los contratos, la pérdida máxima, la ganancia máxima y el punto de equilibrio, o la causa indicada por la API

#### Scenario: Cambiar selección durante una consulta en curso
- **WHEN** llega una respuesta de una selección anterior después de cambiar los cores activos
- **THEN** el panel muestra el estado o resultado de la selección vigente

### Requirement: Estados del análisis con datos verificables

La vista por cores SHALL distinguir carga, resultado completo, análisis parcial, ausencia de candidatos y error del proveedor. SHALL mostrar los motivos de exclusión y permitir reintentar una consulta fallida. Los resultados visibles SHALL proceder de la consulta correspondiente a la selección vigente.

#### Scenario: Proveedor temporalmente indisponible
- **WHEN** la API por cores responde `503`
- **THEN** la vista explica que faltan datos reales, permite reintentar y presenta la tabla de recomendaciones vacía

#### Scenario: Resultado parcial y exclusión de una empresa
- **WHEN** la API devuelve candidatos evaluables y una empresa excluida por datos insuficientes o veto de viabilidad
- **THEN** el panel muestra el estado parcial cuando corresponda y permite consultar el motivo sin asignar una posición a la empresa excluida
