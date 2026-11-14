# Proposal

## Why

El escáner v2 ordena candidatos para Collar Spread por probabilidad estimada, prima neta o retorno, y presenta un diagnóstico técnico basado en valores precargados. Integrar los siete cores con fuentes verificables permitirá elegir los criterios de análisis, comparar cómo cambia el ranking y rastrear cada resultado hasta los datos que lo respaldan.

## What Changes

- Integrar los siete cores en el backend del escáner y exponer sus resultados en el panel React. Cada resultado identificará los datos de origen, su fecha, la evidencia del cálculo y el estado de disponibilidad.

| Core | Integración y resultado visible |
|---|---|
| **001 · Técnico** | Calcular tendencia, soportes, resistencias e indicadores como RSI y MACD a partir de series históricas de precio y volumen. |
| **002 · Fundamental** | Calcular salud financiera, valuación y riesgo de eventos a partir de estados financieros publicados, datos de mercado y calendarios de resultados. El diagnóstico alimenta el filtro de viabilidad. |
| **003 · Señales directas** | Evaluar las reglas de señal con indicadores y eventos observados. Mostrar la señal resultante y qué condiciones se cumplieron. |
| **004 · Estrategias de opciones** | Evaluar la adecuación a Collar Spread con contratos, vencimientos, cotizaciones y datos de liquidez de una cadena de opciones verificable. Calcular pérdida máxima, ganancia máxima y punto de equilibrio a partir de esos contratos e indicar la causa si alguna métrica queda indeterminada. |
| **005 · Institucional** | Analizar operaciones de opciones, volumen e interés abierto y, cuando corresponda, reportes institucionales verificables. Mostrar sesgo, fuerza del flujo y zonas de interés respaldadas por esos datos. |
| **006 · Noticias** | Consultar noticias publicadas y vinculadas al activo. Mostrar relevancia, sentimiento, tipo de evento e impacto estimado, con referencia a los titulares usados. |
| **007 · Confluencia** | Combinar las señales activas calculadas por el backend. Mostrar el puntaje, los pesos efectivos, los conflictos y la confianza inferior a 0.95. La confirmación de una señal requiere coincidencia entre fuentes. |

- Permitir que el usuario consulte el resultado de cada Core. Las cinco fuentes de señales se podrán activar de forma individual o combinada. Con una sola, el ranking se ordenará por su criterio. Con varias, se actualizará el puntaje del Core 007 y se mostrará cómo contribuyó cada fuente. El Core 004 aportará la evaluación de la estrategia elegida.
- Alimentar el nuevo ranking exclusivamente con datos reales de procedencia y vigencia verificables. Si falta información, está desactualizada o falla un proveedor, mostrar la causa y señalar cualquier resultado parcial. Si no se puede verificar la viabilidad o faltan datos esenciales, abstenerse de sugerir la estrategia. El veto para empresas `MARGINAL` o `NO_VIABLE` se aplica aunque Fundamental esté desmarcado del puntaje.
- Agregar `POST /api/v2/strategy-screener/run` como consulta informativa. El alcance de estrategias de este cambio cubre `COLLAR_SPREAD` en el modo Por estrategia. Los modos Libre y Por empresa y la ampliación del catálogo se contemplan en cambios posteriores.

## Capabilities

### New Capabilities

- `strategy-screener-api` incorpora el ranking de candidatos con selección de cores, confluencia explicable, veto de viabilidad y evaluación informativa de la estrategia.

### Modified Capabilities

- `presentacion-frontend-react` amplía el panel del escáner con la selección de cores, el orden por puntaje y el desglose por empresa.

## Impact

- **API y panel.** El nuevo endpoint se incorpora al enrutador v2 y al contrato OpenAPI. `GET /api/v2/market/scanner/top-collars` y los endpoints vigentes de `/api/v1` conservan sus contratos. El panel integra el ranking por cores junto a los criterios de escaneo existentes. La emisión de órdenes sigue siendo una acción explícita del flujo de coberturas.
- **Datos.** Verificar el acceso y la cobertura de los proveedores que usa el sistema e incorporar las fuentes necesarias de históricos, estados financieros, eventos, cotizaciones y flujo de opciones, reportes institucionales y noticias. El nuevo flujo mostrará un estado de datos insuficientes cuando solo haya valores precargados, primas teóricas de referencia o un respaldo simulado.
- **Verificación de la integración.** Demostrar el recorrido de extremo a extremo desde los proveedores hasta la API v2 y el panel. La evidencia incluirá resultados trazables de los siete cores, la activación individual de las cinco fuentes y su combinación, un caso de veto y una falla de proveedor que produzca un estado explícito de datos insuficientes. Verificar también la compatibilidad del escáner vigente.
- **Evidencia académica.** Registrar los resultados de las verificaciones, la autoría y las herramientas usadas en cada aporte. Respaldar cualquier optimización manual con su comparación antes y después.
