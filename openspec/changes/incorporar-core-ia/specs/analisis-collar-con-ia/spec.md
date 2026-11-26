# Spec Delta

## Purpose

Ofrecer una evaluación informativa de empresas para Collar Spread con pronunciamientos verificables a partir de los diagnósticos del escáner.

## ADDED Requirements

### Requirement: Consulta independiente de oportunidades para Collar Spread

`POST /api/v2/strategy-screener/ai-analysis` SHALL requerir sesión y aceptar `scope` (`CANDIDATES` o `SYMBOL`), `activeCores` y el horizonte `dteHorizon`. `SYMBOL` SHALL requerir un ticker. `CANDIDATES` SHALL admitir símbolos adicionales. La API SHALL comparar hasta diez candidatas con evidencia y devolver hasta tres sugerencias, o devolver un análisis del ticker solicitado aunque esté fuera del ranking visible. La evaluación SHALL ser informativa y de solo lectura. La consulta SHALL conservar el contrato, filtros de elegibilidad, orden y puntajes del escáner cuantitativo.

#### Scenario: Sugerir candidatas
- **WHEN** una sesión válida solicita sugerencias para el horizonte seleccionado
- **THEN** recibe hasta tres empresas elegibles para revisar o una explicación si la evaluación no arroja sugerencias

#### Scenario: Evaluar la empresa seleccionada
- **WHEN** una sesión válida consulta un ticker fuera del ranking visible
- **THEN** recibe un análisis del ticker para el horizonte solicitado, sin alterar el ranking

### Requirement: Veredicto con motivos, riesgos y fuentes

La consulta SHALL devolver el instante de corte y el horizonte analizado. El veredicto por empresa SHALL indicar `CONSIDER`, `AVOID`, `WAIT` o `INSUFFICIENT_DATA`. Las conclusiones generadas SHALL referenciar evidencia de mercado o diagnósticos del servidor de la empresa correspondiente. La evidencia SHALL incluir fuente e instante de observación. La falta de datos esenciales y los vetos de viabilidad o de liquidez SHALL conservar su significado. El modelo SHALL recibir únicamente diagnósticos y contexto de mercado necesario para la consulta.

Las sugerencias SHALL presentar las candidatas elegidas de mejor a menor ajuste al Collar Spread para el horizonte solicitado. Cada empresa SHALL tener uno o dos motivos breves en español, con palabras cotidianas y los términos técnicos indispensables, y hasta dos riesgos relevantes respaldados por la evidencia. El panel SHALL omitir el apartado de riesgos cuando la lista esté vacía.

#### Scenario: Identificar la primera sugerencia y explicar sus riesgos
- **WHEN** el Core de IA presenta sugerencias
- **THEN** el panel identifica a la primera como «La que mejor califica» para la estrategia analizada
- **AND** cuando hay riesgos, aparecen bajo «Por qué podría no convenir» y explican en lenguaje cotidiano qué podría pasar y cómo afecta la decisión

#### Scenario: Resumen sin un riesgo relevante respaldado
- **WHEN** el modelo recomienda una empresa, explica su elección y devuelve una lista vacía de riesgos
- **THEN** la API acepta el resultado y el panel muestra los motivos de la recomendación

#### Scenario: Datos incompletos
- **WHEN** faltan datos esenciales o el calendario de la empresa queda sin verificar
- **THEN** la consulta individual muestra datos insuficientes con su causa y la empresa no aparece como sugerencia

#### Scenario: Empresa excluida por viabilidad o liquidez
- **WHEN** la empresa tiene un veto de viabilidad o carece de collar líquido
- **THEN** la consulta individual indica que no cumple los criterios para Collar Spread y explica el motivo del escáner

#### Scenario: Fallos del servicio
- **WHEN** faltan credenciales, fallan las fuentes globales o el proveedor de IA no está disponible
- **THEN** la consulta responde `503` con una causa sin información secreta
- **AND** devuelve `400` para criterios inválidos, `401` si falta sesión, `429` al alcanzar el límite temporal del servicio o la cuota del proveedor y `502` para respuestas inválidas del proveedor

### Requirement: Proveedor de IA configurable en el servidor

El Core de IA SHALL usar Gemini 3.1 Flash-Lite por defecto y permitir seleccionar OpenAI explícitamente desde el entorno del backend. El servidor SHALL conservar el mismo formato de veredictos y validar la evidencia con cualquiera de los proveedores. Una consulta SHALL usar únicamente el proveedor seleccionado.

#### Scenario: Probar con Gemini
- **WHEN** el servidor tiene una clave de Gemini y se solicita un análisis con evidencia suficiente
- **THEN** el servidor llama a Gemini, devuelve el modelo usado y verifica los motivos y riesgos contra la evidencia del escáner

#### Scenario: Cuota de Gemini agotada
- **WHEN** Gemini responde `429`
- **THEN** la consulta informa la cuota agotada con `429` y termina sin llamar a otro proveedor

### Requirement: Consulta de IA en el panel de cores

El panel SHALL ofrecer «Sugerir empresas» y «Analizar» con el ticker seleccionado. Las solicitudes SHALL iniciarse por acción explícita del usuario y reflejar los filtros actuales, el símbolo, el corte y la estrategia. El panel SHALL mostrar resultados, motivos, riesgos, fuentes y mensajes de carga o error. Si cambia el ticker o los filtros, SHALL retirar cualquier resultado que corresponda al contexto anterior.

#### Scenario: Cambiar de empresa durante el análisis
- **WHEN** el usuario cambia el ticker mientras espera el análisis individual
- **THEN** el panel descarta esa respuesta y permite consultar el nuevo ticker

#### Scenario: Error de IA con ranking disponible
- **WHEN** la consulta de IA falla después de una evaluación cuantitativa válida
- **THEN** el panel muestra el error y el ranking permanece disponible
