# Spec Delta

## Purpose

Clasificar empresas candidatas a Collar Spread a partir de los cores seleccionados, con datos de mercado verificables y un desglose que permita entender y reproducir el resultado.

## ADDED Requirements

### Requirement: Solicitud de análisis por estrategia

`POST /api/v2/strategy-screener/run` SHALL aceptar un token de sesión y un cuerpo JSON con `mode: BY_STRATEGY`, `strategy: COLLAR_SPREAD` y `activeCores` como arreglo no vacío de identificadores únicos del conjunto `001`, `002`, `003`, `005` y `006`. `limit` SHALL aceptar enteros de 1 a 10 y usar 5 por defecto. `dteHorizon` SHALL aceptar 30, 45 o 60 y usar 45 por defecto. La API SHALL analizar el universo de empresas configurado y devolver `200` con el corte de datos, los parámetros aplicados, el estado de análisis, los candidatos ordenados hasta el límite solicitado y los motivos de exclusión por activo. Cada candidato SHALL incluir ticker, posición, puntaje y resultados de los cores que participaron. La operación SHALL ser informativa y de solo lectura.

#### Scenario: Solicitar Collar Spread con dos fuentes
- **WHEN** se envía una solicitud autenticada con `activeCores` igual a `["001", "006"]` y se omiten `limit` y `dteHorizon`
- **THEN** se devuelve el resultado del modo Por estrategia con un máximo de cinco candidatos, un horizonte objetivo de 45 días y la selección aplicada

#### Scenario: Validar la solicitud antes de consultar proveedores
- **WHEN** la selección está vacía, contiene identificadores repetidos o desconocidos, o se envían modos, estrategias o parámetros fuera del contrato
- **THEN** la API responde `400` e identifica la entrada inválida antes de iniciar el análisis

#### Scenario: Solicitud sin sesión válida
- **WHEN** falta el token, es inválido o ha caducado
- **THEN** la API responde `401` y no consulta proveedores

#### Scenario: Ejecutar una consulta informativa
- **WHEN** se analiza una empresa y se encuentra una cobertura apta
- **THEN** se devuelve la evaluación sin crear órdenes ni guardar una cobertura en el portafolio

### Requirement: Resultados trazables de los siete cores

El escáner SHALL integrar los siguientes resultados en el backend y hacerlos accesibles en la respuesta. Cada Core SHALL informar su estado y, cuando calcule un resultado, aportar evidencia con proveedor, instante o periodo observado y referencias a las observaciones o reglas aplicadas.

| Core | Resultado que SHALL entregar con evidencia suficiente |
|---|---|
| `001` Técnico | Tendencia y fuerza, soportes, resistencias, indicadores técnicos y puntaje a partir de velas históricas de precio y volumen. |
| `002` Fundamental | Salud financiera, valuación, alertas de calidad y riesgo de eventos a partir de estados financieros publicados, precios y calendario de resultados. |
| `003` Señales directas | Señal individual, fuerza y reglas disparadas a partir de observaciones verificadas de precio, indicadores y eventos. |
| `004` Estrategias de opciones | Contratos seleccionados, condiciones de liquidez y métricas de Collar Spread a partir de cotizaciones observadas. |
| `005` Institucional | Intensidad, zonas de interés y sesgo sustentado por actividad observable de opciones, interés abierto y reportes institucionales cuando correspondan. Los sesgos inferidos SHALL identificarse como inferencias. |
| `006` Noticias | Tipo de evento, relevancia, sentimiento e impacto estimado a partir de titulares publicados y asociados con el activo. |
| `007` Confluencia | Puntaje combinado, pesos efectivos, coincidencias, conflictos y confianza para el conjunto de señales activas. |

#### Scenario: Verificar los resultados del análisis
- **WHEN** se solicita el análisis con las cinco fuentes activas y existen datos suficientes de proveedores reales
- **THEN** la API devuelve los siete resultados con evidencia y fecha o periodo observable, incluidos los contratos de opciones y los titulares en los que se basó el análisis

#### Scenario: Diferenciar una ventana sin noticias de una fuente caída
- **WHEN** un proveedor operativo confirma que la consulta completa no encontró titulares para el activo en la ventana evaluada
- **THEN** Noticias devuelve un resultado neutral con evidencia de la ventana consultada y sin atribuirle titulares

### Requirement: Ranking según las fuentes activas

Con una fuente activa, la API SHALL ordenar las empresas aptas según el puntaje de esa fuente para la estrategia y señalar que el análisis es individual. Con varias fuentes activas, el Core 007 SHALL ordenar por el puntaje combinado, informar pesos efectivos, coincidencias y conflictos y limitar la confianza reportada a un valor inferior a `0.95`. Los cores ejecutados como dependencias o para verificar la viabilidad SHALL quedar fuera de la ponderación si no fueron seleccionados. La señal final `BUY` o `SELL` SHALL requerir confirmación direccional entre fuentes independientes. Los conflictos fuertes con evidencia suficiente SHALL resultar en `HOLD`. Con las mismas observaciones y parámetros, la API SHALL producir el mismo orden y desglose.

#### Scenario: Activar cada fuente de forma individual
- **WHEN** se selecciona cualquiera de los cores `001`, `002`, `003`, `005` o `006` por separado y se cuenta con datos suficientes
- **THEN** el resultado usa su puntaje para ordenar el ranking e identifica la fuente elegida, sin presentar una señal confirmada por confluencia

#### Scenario: Combinar fuentes con señales contradictorias
- **WHEN** varias fuentes activas difieren de forma fuerte sobre la dirección y hay evidencia suficiente para compararlas
- **THEN** el resultado muestra el puntaje combinado, el conflicto, los pesos efectivos y la señal `HOLD`

#### Scenario: Evitar que una regla derivada duplique la confirmación
- **WHEN** Técnico y Señales directas coinciden por haber usado la misma evidencia de precio
- **THEN** el desglose muestra la dependencia y esa coincidencia por sí sola no confirma una señal direccional

### Requirement: Elegibilidad y evaluación informativa de Collar Spread

La API SHALL aplicar la viabilidad antes de recomendar una estrategia, incluso si `002` no está seleccionado para el puntaje. Deberá excluir del ranking de recomendaciones a los activos `MARGINAL` y `NO_VIABLE`, a los que tengan viabilidad sin verificar y a los que carezcan de contratos o liquidez suficientes. Para las coberturas aptas SHALL identificar el put, el call y el vencimiento utilizados y mostrar pérdida máxima, ganancia máxima y punto de equilibrio. Si alguna métrica queda indeterminada, SHALL indicar la causa y abstenerse de sugerir una cobertura cuando falte un dato esencial.

#### Scenario: Veto con Fundamental desactivado
- **WHEN** se activa únicamente Técnico y una empresa con puntaje alto queda clasificada como `MARGINAL` o `NO_VIABLE`
- **THEN** la empresa no aparece como recomendación y se informa la causa de exclusión

#### Scenario: Calcular métricas de una cobertura apta
- **WHEN** existen un put y un call líquidos y compatibles para el horizonte solicitado, con cotizaciones válidas y viabilidad confirmada
- **THEN** se devuelven los contratos, el vencimiento real, las cotizaciones utilizadas y las tres métricas calculadas

### Requirement: Disponibilidad y procedencia de los datos

El cálculo SHALL utilizar exclusivamente observaciones reales y vigentes para su ventana de análisis. El resultado SHALL identificar las fuentes, los retrasos conocidos y las causas de datos insuficientes por activo y Core. Si un activo carece de una fuente seleccionada necesaria para calcular un puntaje comparable, SHALL quedar sin posición y se informará el motivo. Una respuesta `200` parcial SHALL identificar los resultados que pudieron calcularse. Una indisponibilidad de las fuentes que impida realizar toda la consulta SHALL producir `503` con un motivo apto para mostrar al usuario.

#### Scenario: Falla parcial de proveedor
- **WHEN** una fuente activa falla para un activo y otros activos conservan todas sus fuentes activas y datos de elegibilidad
- **THEN** la API devuelve `200` con estado parcial, ordena los activos evaluables y explica por qué el activo afectado carece de posición

#### Scenario: Proveedor sin datos utilizables
- **WHEN** los proveedores requeridos no permiten evaluar ningún activo y solo existen respaldos sintéticos, precargados o indicativos con cotizaciones modificadas
- **THEN** la API responde `503` con la causa de la indisponibilidad y el ranking queda sin resultados calculados con esos datos

#### Scenario: Universo evaluado sin cobertura apta
- **WHEN** hay datos suficientes para completar la consulta y ninguna empresa cumple los criterios de la cobertura
- **THEN** la API responde `200` con el ranking vacío y los motivos correspondientes

### Requirement: Compatibilidad del escáner y las coberturas vigentes

`GET /api/v2/market/scanner/top-collars`, su alias `GET /api/v2/scanner/top-collars` y las rutas de `/api/v1` SHALL conservar sus contratos y comportamiento. El cálculo de análisis por cores SHALL permanecer separado del flujo de emisión de órdenes.

#### Scenario: Consultar el ranking existente
- **WHEN** un consumidor solicita `top-collars` con los parámetros vigentes
- **THEN** recibe la estructura y el ordenamiento previstos por el contrato existente
