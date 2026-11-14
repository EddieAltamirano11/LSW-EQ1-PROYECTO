# Design

## Context

`scanTopCollars` en `src/api/v2/services/scanner.service.js` recorre `MARKET_BASKET`, consulta el precio spot con respaldo de referencia, lee el RSI y la SMA 200 precargados y estima primas a partir de Black-Scholes. `Dashboard.jsx` consume ese contrato y recurre a `computeLocalCandidates` si la respuesta no contiene candidatos. El adaptador de `broker.service.js` también puede devolver cotizaciones de respaldo y construye una cadena sintética en su rama de Alpaca. Esos contratos siguen prestando el servicio vigente. El análisis por cores necesita recibir y comprobar la procedencia de las observaciones antes de calcular el ranking.

## Goals / Non-Goals

El análisis se concentra en una consulta de solo lectura bajo `/api/v2`, con el caso `BY_STRATEGY` para `COLLAR_SPREAD`. El panel presenta los siete resultados y consume la clasificación del servidor. Los cálculos de valoración y cobertura se reutilizan donde puedan ejecutarse de forma pura. La persistencia de coberturas y el envío de órdenes pertenecen al flujo de ejecución existente.

## Decisions

### Flujo de análisis en el servidor

Montar un router bajo `/api/v2/strategy-screener` siguiendo el patrón rutas → controlador → servicio de Express. La ruta `POST /run` valida sesión y cuerpo antes de llamar a proveedores. El middleware JWT actual admite peticiones anónimas, de modo que el nuevo router exige un `req.user` validado para proteger la cuota de datos sin cambiar la autenticación de las otras rutas. Usar el manejador de errores existente para `400`, `401` y `503`, con mensajes aptos para el panel.

El servicio fija un corte por solicitud y usa los símbolos de empresas de la canasta existente como universo inicial. Los instrumentos sin una política de viabilidad aplicable, como los ETF de la canasta, se identifican como fuera del universo de empresas. El servicio carga las observaciones requeridas por las fuentes seleccionadas y las comprobaciones obligatorias de viabilidad y opciones. Comparte las series, eventos y contratos entre los cores que los usan y calcula cada diagnóstico una vez por activo y corte. Se aprovechan el cliente Axios y la configuración de Alpaca donde la respuesta permita verificar su origen. La ruta separada conserva los contratos de `top-collars` y sus consumidores.

El cuerpo incluye `mode`, `strategy`, `activeCores` y los filtros opcionales `limit` y `dteHorizon`. La respuesta incluye `asOf`, `criteria`, `status` (`COMPLETE` o `PARTIAL`), `candidates` y `excluded`. Los candidatos incluyen `symbol`, `rank`, `score`, `eligibility` y `cores` indexados por identificador. Los descartes incluyen ticker, causa y diagnósticos disponibles. Cada diagnóstico declara `status` (`AVAILABLE`, `PARTIAL`, `UNAVAILABLE` o `NOT_SELECTED`), resultado y evidencia con referencias de origen. Si ninguna empresa es evaluable por indisponibilidad de proveedores, responder `503`. Una consulta evaluada sin empresas aptas devuelve `200` con una lista vacía y causas de exclusión.

### Fuentes de datos y vigencia

El proveedor y su modo de entrega se configuran en el backend. El broker seleccionado para emitir órdenes y el origen de datos del análisis son decisiones independientes. Antes de habilitar una fuente, comprobar acceso de la cuenta, campos obligatorios, cobertura, latencia, límites y permisos de uso. Las fuentes siguientes son candidatas documentadas. La cuenta del equipo y sus permisos quedan por verificar.

| Datos | Fuente y comprobación |
|---|---|
| Velas y spot de acciones | Alpaca Market Data con feed explícito, velas cerradas, ajustes por splits para el histórico y spot observado para la cobertura. Registrar el feed y su alcance. [Velas históricas](https://docs.alpaca.markets/us/reference/stockbarsingle-1), [snapshot de acción](https://docs.alpaca.markets/us/reference/stocksnapshotsingle). |
| Estados financieros y eventos | SEC EDGAR Company Facts y Submissions, con mapeo ticker–CIK, periodos comparables y fecha de publicación. Para próximos resultados, consultar un calendario documentado como FMP y conservar la distinción entre fecha confirmada y estimada cuando la fuente la entregue. [SEC EDGAR](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), [calendario de FMP](https://site.financialmodelingprep.com/developer/docs/stable/earnings-calendar). |
| Opciones y flujo | Validar contratos, multiplicador, vencimiento, cotizaciones observadas, volumen, operaciones e interés abierto. Alpaca documenta cadena OPRA y metadatos de contratos con interés abierto. Massive es candidato para cadena y series de operaciones y cotizaciones contemporáneas si los permisos existentes no cubren esos campos. Admitir únicamente cotizaciones observadas con el retraso y corte identificados. El feed `indicative` de Alpaca tiene cotizaciones modificadas y queda fuera del cálculo. [Feeds de Alpaca](https://docs.alpaca.markets/us/docs/historical-option-data), [contratos de Alpaca](https://docs.alpaca.markets/us/reference/get-options-contracts), [cadena de Massive](https://massive.com/docs/rest/options/snapshots/option-chain-snapshot), [operaciones de Massive](https://massive.com/docs/rest/options/trades-quotes/trades), [cotizaciones de Massive](https://massive.com/docs/rest/options/trades-quotes/quotes). |
| Reportes institucionales | SEC Form 13F como contexto de posiciones reportadas. Conservar el trimestre y la publicación del reporte, y emparejar por identificadores del instrumento. [Datos 13F de la SEC](https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets). |
| Noticias | Alpaca News por símbolo, con paginación y ventana temporal. Conservar ID, fuente, título, fecha y URL cuando se proporcionen. [API de noticias de Alpaca](https://docs.alpaca.markets/us/reference/news-3). |

Normalizar las observaciones con fuente, símbolo, instante o periodo, fecha de publicación cuando aplique, y corte. Validar la vigencia por clase de dato y sesión de mercado, y conservar el retraso declarado. Deduplicar peticiones, acotar concurrencia, paginación y tiempo total, y reutilizar únicamente observaciones verificadas que sigan vigentes. Si una fuente falla o entrega datos incompletos, el diagnóstico identifica la causa. Los datos sintéticos y las primas teóricas de respaldo quedan fuera del nuevo flujo. Si una fuente seleccionada no puede aportar un puntaje comparable, el activo se devuelve sin posición.

### Cálculo y composición de los cores

| Core | Implementación propuesta |
|---|---|
| **001** | Calcular tendencia con EMA 20/50, estructura de máximos y mínimos y ADX 14. Derivar zonas con pivotes, números redondos y volumen por nivel cuando la fuente lo sustente. Incluir RSI 14, MACD 12/26/9, ROC, ATR y bandas de Bollinger 20/2. Usar velas cerradas diarias, horarias y de 15 minutos para contexto, confirmación y disparador. Una ruptura requiere cierre y volumen relativo superior a 1.2. Registrar qué capas coinciden, los conflictos de horizonte y el rezago de los indicadores. |
| **002** | Calcular calidad, crecimiento, solvencia y valuación sobre periodos comparables. Evaluar Piotroski y la variante de Altman aplicable con sus supuestos y limitaciones. Documentar umbrales de viabilidad por clase de empresa y exigir evidencia suficiente antes de asignar `VIABLE`, `MARGINAL` o `NO_VIABLE`. Mantener un estado indeterminado para cobertura o comparables insuficientes. Derivar el riesgo de eventos de fechas verificables. |
| **003** | Evaluar reglas deterministas de dirección, confirmación técnica y riesgo de evento con el mismo corte. Devolver fuerza, reglas activadas y observaciones. La señal individual se calcula antes de la confluencia. La confirmación entre fuentes pertenece al Core 007, lo que evita una dependencia circular. |
| **004** | Resolver la expiración disponible más cercana al horizonte solicitado dentro de una tolerancia documentada. Evaluar puts y calls compatibles del mismo vencimiento, con strikes, entregables y multiplicador compatibles con el Collar, y validar liquidez con spread, volumen e interés abierto. Valorar el costo de referencia con el ask observado del put y el bid observado del call. Reutilizar o extraer los cálculos puros de la cobertura y expresar los resultados al vencimiento con la base de costo y tamaño asumidos. Las cotizaciones y el escenario de cálculo quedan identificados. |
| **005** | Agregar operaciones reales por contrato, strike, vencimiento y sesión. Usar volumen sobre interés abierto y prima negociada para detectar actividad inusual. Estimar presión compradora o vendedora solo con cotizaciones contemporáneas o un campo equivalente verificable. Las operaciones que no permiten determinar el lado se conservan como actividad sin dirección confirmada. Presentar zonas gamma como estimaciones cuando existan los datos necesarios y contextualizar con 13F si aplica. Registrar el alcance de cada inferencia y la incertidumbre sobre apertura, cierre e identidad del participante. |
| **006** | Deduplicar por identificador o URL y agrupar duplicados entre fuentes. Clasificar tipo de evento, relevancia por símbolo y sentimiento en el backend. Versionar el clasificador de sentimiento financiero, con FinBERT como candidato para el uso académico sujeto a sus condiciones, y registrar la confianza, la ventana y los titulares que aportan al impacto estimado. [Ficha de FinBERT](https://huggingface.co/ProsusAI/finbert). |
| **007** | Normalizar cada aporte a una escala 0–100 de adecuación a Collar Spread y conservar la métrica original. Con una fuente, el resultado es su puntaje individual. Con varias, usar como punto de partida los pesos de la guía 30/20/20/15/15 para 001/002/003/005/006, normalizados sobre las fuentes seleccionadas. Cuando 001 y 003 comparten evidencia, su grupo usa como peso base el mayor de sus pesos y lo reparte en proporción a sus pesos originales. El desglose muestra los pesos efectivos y las dependencias. Confirmar `BUY` o `SELL` solo con acuerdo direccional entre grupos independientes y con la confianza configurada, con techo estricto inferior a 0.95. Emitir `HOLD` ante conflicto fuerte y usar ticker como desempate del ranking. |

El puntaje representa adecuación al criterio y a la estrategia. El 004 comprueba la aptitud operativa de la estructura y el 002 verifica viabilidad aunque esté desmarcado. El 007 identifica los criterios activos y aplica ponderación únicamente a sus resultados comparables. Versionar las reglas y los umbrales para reproducir una consulta con el mismo corte, observaciones y selección.

### Integración del panel

Extender `Dashboard.jsx` con el ranking por cores, manteniendo los filtros de tamaño y horizonte y la vista vigente. Usar el cliente autenticado de la API y el patrón `AbortController` que ya aplica el panel para descartar respuestas de selecciones anteriores. El desglose incluye puntaje individual o compuesto, pesos, fuentes, fecha, razones de exclusión y las métricas de estrategia disponibles. Ante `503`, mostrar la causa y ofrecer reintento. `computeLocalCandidates` permanece en el ranking clásico.

## Risks / Trade-offs

- **Acceso y cobertura de mercado.** Los permisos pueden variar según proveedor y cuenta. Comprobar muestras reales por tipo de dato antes de cerrar las tareas de integración y documentar los permisos faltantes si impiden la prueba de extremo a extremo.
- **Datos con distintas frecuencias.** Conciliar corte, sesión, fecha de publicación y retraso para evitar combinar cotizaciones incompatibles o usar información posterior al corte.
- **Latencia y cuotas.** Compartir insumos por activo y consulta, filtrar contratos por vencimiento y paginar con presupuesto. Identificar cualquier resultado cuya cobertura quede incompleta.
- **Señales con evidencia compartida.** Agrupar confirmaciones derivadas de la misma observación y conservar el detalle de la dependencia y del desacuerdo.

## Migration Plan

Configurar las fuentes en el entorno de prueba, verificar las muestras reales y desplegar el endpoint v2 antes de habilitar la vista por cores del panel. Confirmar la documentación OpenAPI y los ejemplos Postman contra ese contrato. El despliegue es aditivo y la reversión puede retirar la vista por cores y su ruta conservando el escáner clásico y las coberturas existentes.
