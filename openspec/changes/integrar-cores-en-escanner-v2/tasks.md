# Tasks

## 1. Fuentes de datos reales

- [x] 1.1 Verificar credenciales, permisos, retraso y cobertura de las fuentes del diseño mediante consultas de lectura en un entorno de prueba. Registrar proveedor, campos obtenidos y límites por tipo de dato, con muestras fechadas y credenciales omitidas. La evidencia debe incluir cotizaciones observadas y operaciones de opciones para los cores 004 y 005.
- [x] 1.2 Implementar la normalización y validación de observaciones con procedencia, corte, vigencia y causa de indisponibilidad. Documentar ventanas y límites de consulta por fuente. Verificar deduplicación, paginación, corte temporal, datos obsoletos y rechazo de datos sintéticos o indicativos con cotizaciones modificadas.
- [x] 1.3 Integrar velas históricas cerradas y cotizaciones observadas del subyacente. Verificar con un símbolo real los marcos de tiempo requeridos, el ajuste del histórico y las marcas de tiempo del proveedor.
- [x] 1.4 Integrar estados financieros publicados y calendario de resultados. Verificar el mapeo de un ticker a su CIK, periodos comparables, fechas de publicación y una fecha de evento rastreable a su fuente.
- [x] 1.5 Integrar cadena, cotizaciones, volumen, interés abierto y operaciones reales de opciones. Verificar con contratos de un subyacente real que coincidan símbolo de contrato, vencimiento y multiplicador, y comprobar que los datos para estimar el lado del flujo tengan marcas de tiempo compatibles.
- [x] 1.6 Integrar noticias por ticker y contexto de reportes 13F cuando aplique. Verificar la recuperación y paginación de titulares con su referencia, y el emparejamiento de una posición institucional con su instrumento, periodo y fuente.

## 2. Cálculos de los siete cores

- [x] 2.1 Implementar el Core 001 con tendencia, zonas, momentum, volatilidad y ruptura confirmada. Verificar resultados reproducibles por temporalidad, tratamiento de velas faltantes y ruptura solo con cierre y volumen relativo suficiente.
- [x] 2.2 Implementar el Core 002 con calidad, solvencia, crecimiento, valuación, riesgo de eventos y la clasificación de viabilidad. Documentar reglas aplicables y probar `VIABLE`, `MARGINAL`, `NO_VIABLE` y viabilidad indeterminada con evidencia incompleta.
- [x] 2.3 Implementar el Core 003 y documentar sus reglas de señal y dependencias. Probar casos de dirección favorable, dirección contraria y abstención por falta de evidencia o riesgo de evento.
- [x] 2.4 Implementar el Core 004 para elegir contratos compatibles y estimar pérdida máxima, ganancia máxima y punto de equilibrio. Probar el cálculo con cotizaciones de put y call, un vencimiento sin par apto y el rechazo de opciones ilíquidas o con entregables incompatibles.
- [x] 2.5 Implementar el Core 005 con actividad por contrato, zonas de interés, intensidad y sesgo sustentado. Probar agregación con interés abierto observado y el estado de dirección indeterminada cuando las operaciones carecen de cotización contemporánea o evidencia equivalente.
- [x] 2.6 Implementar el Core 006 con deduplicación, clasificación financiera versionada, relevancia por símbolo e impacto estimado. Probar un evento con titulares duplicados, una ventana consultada sin titulares y una fuente indisponible.
- [x] 2.7 Implementar el Core 007 con normalización, pesos efectivos, conflictos y confianza. Verificar las cinco selecciones individuales, el orden compuesto con entradas controladas, el desempate reproducible, el tope de confianza y `HOLD` cuando corresponda. Probar que una señal derivada de la misma evidencia técnica no confirme por sí sola la dirección.

## 3. API v2 y compatibilidad

- [x] 3.1 Montar `POST /api/v2/strategy-screener/run` con sesión requerida y validación de modo, estrategia, selección y filtros. Probar `400` y `401`, los valores predeterminados y que una entrada inválida evita las consultas a proveedores.
- [x] 3.2 Orquestar la carga compartida, la elegibilidad, la evaluación de Collar Spread y el ranking. Verificar por HTTP el veto con Fundamental desmarcado, el `200` completo sin candidatos, el `200` parcial, el `503` cuando ninguna empresa es evaluable y la ausencia de órdenes o escrituras de coberturas.
- [x] 3.3 Publicar el contrato en OpenAPI y sincronizar los ejemplos Postman de los entornos del repositorio. Comprobar que los ejemplos usan la ruta v2 y que las respuestas documentadas coinciden con las pruebas HTTP.
- [x] 3.4 Ejecutar las pruebas vigentes de escáner, coberturas y compatibilidad con `npm test`. Verificar el contrato y orden de `top-collars`, su alias y los endpoints v1 cubiertos por la suite.

## 4. Panel React

- [x] 4.1 Incorporar el selector de las cinco fuentes y conectar la vista de ranking a la API autenticada. Verificar selección individual y combinada, actualización de filtros y descarte de respuestas anteriores ante cambios rápidos.
- [x] 4.2 Mostrar por activo el resultado de cada Core, su procedencia, los pesos de confluencia, los motivos de exclusión y las métricas de Collar Spread. Verificar en el panel un resultado completo y uno parcial en escritorio y móvil.
- [x] 4.3 Implementar y verificar los estados de carga, ausencia de candidatos y fallo de proveedor con reintento. Confirmar que el ranking por cores presenta el error cuando la API falla y que el flujo de escaneo clásico sigue disponible.

## 5. Verificación de extremo a extremo

- [x] 5.1 Ejecutar la API y el panel contra proveedores habilitados con datos reales. Registrar un resultado trazable de cada uno de los siete cores, las cinco selecciones individuales y una combinación sobre un corte comparable. Verificar los contratos de Collar Spread y los pesos que efectivamente determinaron el ranking.
- [x] 5.2 Verificar en el flujo completo un veto de viabilidad y una falla controlada de un proveedor. Registrar que el panel explica la exclusión o los datos insuficientes y que la consulta no genera órdenes.
- [x] 5.3 Consolidar la evidencia académica con comandos, fecha de corte, resultado verificable, responsables y herramientas. Diferenciar aportes asistidos por IA, trabajo manual comprobado y pendientes, con una comparación antes y después cuando exista optimización manual acreditada.
