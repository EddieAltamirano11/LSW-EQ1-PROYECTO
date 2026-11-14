# Verificación de fuentes para el escáner por cores

Cambio `integrar-cores-en-escanner-v2`, tarea 1.1. Consultas de solo lectura realizadas el 11 de noviembre de 2026, hora de Mazatlán, desde el entorno local. Las marcas de tiempo de las muestras se expresan en UTC. Las peticiones usaron las credenciales ya configuradas en el proyecto y la salida se redujo a estado HTTP, campos y fechas de las observaciones.

| Fuente consultada | Resultado observado |
|---|---|
| [Alpaca Market Data, velas](https://docs.alpaca.markets/us/reference/stockbarsingle-1) y [cotización](https://docs.alpaca.markets/us/reference/stocksnapshotsingle) | `200` para AAPL con el feed `iex`. Vela diaria con apertura, máximo, mínimo, cierre, volumen y marca `2026-11-11T05:00:00Z`. Cotización con bid, ask y marca `2026-11-11T21:00:00.000691537Z`. |
| [Alpaca News](https://docs.alpaca.markets/us/reference/news-3) | `200` y tres artículos de AAPL con identificador, titular, fuente, URL y fecha. Primera muestra con fecha de publicación `2026-11-12T01:15:56Z`. |
| [Contratos de Alpaca](https://docs.alpaca.markets/us/reference/get-options-contracts) y [operaciones históricas](https://docs.alpaca.markets/us/reference/optiontrades) | `200` en ambas consultas. Los contratos traen símbolo, vencimiento, multiplicador, interés abierto y su fecha. La consulta histórica devolvió diez operaciones con precio, tamaño y marca temporal, incluida `2026-11-09T12:37:18.980505847Z`. |
| [Cadena OPRA de Alpaca](https://docs.alpaca.markets/us/reference/optionchain) | `403` al solicitar explícitamente `feed=opra`. |
| [Cotizaciones de opciones de Webull](https://developer.webull.com/apis/docs/reference/option-snapshot/) y [operaciones](https://developer.webull.com/apis/docs/reference/option-tick/) | `200` en el entorno de pruebas con firma de OpenAPI v3. El contrato `AAPL261120C00365000` tenía bid y ask válidos, volumen, interés abierto y `delay_minutes: 15`. La cotización tenía marca `2026-11-11T21:07:16.679Z`. La consulta del mismo contrato devolvió 30 operaciones con precio, volumen, lado informado y hora. La última operación de la muestra fue `2026-11-11T21:07:16.674Z`. La documentación de Webull describe el retraso del entorno de pruebas. [Permisos y retraso](https://developer.webull.com/apis/docs/market-data-api/overview/). |
| [Calendario de Webull](https://developer.webull.com/apis/docs/reference/earnings-calendar/) y [alertas de próximos resultados](https://developer.webull.com/apis/docs/reference/financial-alert/) | `200`. La alerta devolvió para NVDA un intervalo estimado del `2026-11-17` al `2026-11-17`, y para AAPL del `2027-01-27` al `2027-02-01`. Los campos de fecha son `start_date` y `end_date`. |
| [Estados financieros de Webull](https://developer.webull.com/apis/docs/reference/financial-balancesheet/) | `200` con listas vacías para los estados de AAPL probados y para los balances trimestrales de AAPL y NVDA. El listado de publicaciones de AAPL devolvió siete enlaces fechados a la SEC. |
| [SEC EDGAR](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | `403` desde el entorno local en Company Facts, Company Concept y Submissions para AAPL. También devolvió `403` una publicación enlazada por Webull. |
| [Reportes 13F de Webull](https://developer.webull.com/apis/docs/reference/list-institution-holdings/) | `403` con `MARKET_DATA_NOT_SUBSCRIBED`. |
| [Calendario de FMP](https://site.financialmodelingprep.com/developer/docs/stable/earnings-calendar) e IBKR TWS | FMP devolvió `401` con la configuración local sin credencial de FMP. La conexión a TWS en el puerto local 7497 fue rechazada. |

## Revalidación de EDGAR

El 12 de noviembre de 2026 se obtuvo `200` desde PowerShell y desde Node al identificar al equipo con el contacto autorizado en `User-Agent`. El índice público devolvió 10 405 registros. Company Facts devolvió el CIK `320193` de AAPL y datos publicados para los ejercicios cerrados el `2025-09-27` y el `2026-09-26`. Submissions y la tabla XML del 13F `0001193125-26-352200` de Berkshire Hathaway respondieron `200`. La tabla de 178 registros incluye Apple (`037833100`), con periodo al `2026-06-30` y presentación el `2026-08-14`.

Las muestras cubren el entorno de pruebas local. Alpaca proporcionó acciones, metadatos de contratos y noticias. Webull proporcionó cotizaciones y operaciones de opciones con retraso identificado, además de alertas de resultados. EDGAR proporcionó los estados financieros y la posición 13F. Se conservarán proveedor, periodo, fecha y retraso en los diagnósticos del escáner.

## Ventanas de datos del escáner

| Datos | Política del flujo v2 |
|---|---|
| Precios | Alpaca IEX. El calendario fija la sesión y el corte común de mercado se retrasa 15 minutos respecto a la consulta. El precio de referencia se toma de una vela de un minuto cerrada en la última hora de esa sesión. |
| Técnico | Velas ajustadas por desdoblamientos en 1 día, 1 hora y 15 minutos. Se requieren al menos 60 velas cerradas por temporalidad y presencia de la última sesión aplicable. Los históricos se consultan con hasta ocho páginas. |
| Fundamental | EDGAR US GAAP con dos ejercicios anuales comparables. Se usa la hora de aceptación de la presentación o la fecha publicada con un margen de un día si falta la hora. El ejercicio más reciente admite hasta 460 días. Las alertas de Webull aportan un intervalo estimado de resultados. |
| Opciones | Contratos activos dentro de ±10 días del horizonte. Se consultan hasta 18 contratos estándar cercanos a los strikes objetivo y tres vencimientos. El filtro exige bid positivo, spread relativo de hasta 35 %, al menos un contrato operado e interés abierto mínimo de diez. Webull aporta el retraso de la cotización. |
| Institucional | Se toman hasta 120 operaciones por contrato en los dos contratos con más volumen de la muestra. La inferencia direccional usa el lado informado de la operación. El 13F consulta a Berkshire Hathaway y se identifica el instrumento por CUSIP. Las posiciones corresponden al periodo declarado. |
| Noticias | Ventana de siete días al corte, deduplicada por identificador, enlace o titular. El clasificador financiero en inglés usa reglas versionadas. El panel muestra el impacto como estimación. |

## Política de análisis

- **Viabilidad.** Se usa la variante Altman Z para emisoras públicas manufactureras y Z doble prima para no manufactureras según SIC. Los umbrales inferior y superior son 1.81 y 2.99, y 1.10 y 2.60 respectivamente. Por debajo del inferior se aplica `NO_VIABLE`. Dentro de la zona gris o con flujo operativo o utilidad operativa no positivos se aplica `MARGINAL`. Los indicadores faltantes quedan identificados. La valoración usa bandas de referencia de múltiplos y Piotroski se identifica como aproximación con los dos ejercicios disponibles. [Estudio de Piotroski](https://www.ivey.uwo.ca/media/3775523/value_investing_the_use_of_historical_financial_statement_information.pdf).
- **Señales.** Un sesgo técnico de magnitud mínima 45 requiere acuerdo diario y horario. Un evento en hasta siete días lleva la señal directa a `HOLD`. La confirmación final exige coincidencia de dos grupos de evidencia y confianza de al menos 0.65. Técnico y Señales directas comparten grupo cuando se activan juntos.
- **Cobertura.** Las métricas usan un put al ask, un call al bid y las acciones al precio observado de referencia. Se muestran en USD al vencimiento, antes de comisiones y con los supuestos de tamaño identificados.

## Ejecución local

La API y el panel usan los proveedores de lectura indicados arriba. El entorno de Render requiere configurar el contacto de EDGAR y verificar la conectividad y los permisos de uso de los datos de opciones antes de habilitar este flujo allí.

## Verificación de extremo a extremo

La API local respondió `200 PARTIAL` con las cinco fuentes activas, horizonte de 45 días y corte `2026-11-12T23:11:48.260Z`. Devolvió cinco candidatos con los siete cores disponibles. GOOGL quedó excluida por fecha de resultados sin verificar. AMZN y AMD quedaron excluidas por cobertura contable insuficiente. En la misma sesión, `GET /api/v2/market/scanner/top-collars` respondió `200` para el escáner clásico.

La muestra de MSFT quedó en la primera posición, con puntaje 71.88. El Core 001 usó velas de Alpaca IEX. El 002 usó estados de EDGAR, precio de Alpaca y una alerta de Webull. El 003 aplicó reglas a las observaciones técnicas y al evento. El 004 usó `MSFT261224P00495000` y `MSFT261224C00550000` con metadatos de Alpaca y cotizaciones de Webull. El 005 usó operaciones de Webull y el contexto 13F de EDGAR. El 006 usó titulares de Alpaca News. El 007 aplicó pesos efectivos de 22.5 %, 25 %, 15 %, 18.75 % y 18.75 % a los cores 001, 002, 003, 005 y 006 respectivamente.

Las consultas individuales devolvieron `200` y cinco candidatos cada una, con el mismo corte. Técnico, Fundamental, Señales directas, Institucional y Noticias colocaron primero a TSLA, AAPL, AAPL, MSFT y MSFT respectivamente. En modo individual, la API devolvió un solo peso y la señal de confluencia quedó sin confirmar.

Chromium con Playwright comprobó el ranking y el desglose de confluencia y Collar Spread a 1280 y 360 píxeles. Una prueba controlada con los mismos componentes de la API y del panel mostró `MARGINAL` con Fundamental desactivado, cero candidatos y el motivo de exclusión. Al interrumpir deliberadamente la fuente, la API devolvió `503` y el panel mostró el error y el botón de reintento. Al recuperar la fuente, el panel mostró un resultado completo en ambos tamaños y descartó una respuesta anterior al cambiar rápidamente la selección. Las consultas de análisis registraron cero solicitudes de emisión de órdenes.

Comandos de verificación del repositorio `npm test` (85 aprobadas), `npm --prefix client run build` y `openspec validate integrar-cores-en-escanner-v2 --strict`. El ejemplo de Postman se sincronizó con `python scripts/build_full_postman_collection.py --strategy-screener-only`. La reproducción local del flujo real usa la sesión del panel y la consulta descrita en el README, con un proveedor de datos disponible en cada caso.

La implementación y las pruebas automatizadas fueron asistidas por Codex. Jesús confirmó manualmente un `HTTP 200` de EDGAR desde PowerShell con el contacto del equipo. El registro de optimización manual queda pendiente de la evidencia del equipo.
