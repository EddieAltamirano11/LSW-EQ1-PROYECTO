# Proposal

## Why

La pestaña «Cómo se calcula» del modal de consulta por core describe el Core 002 con una sola frase por campo: nombra Altman Z y Piotroski sin definirlos, no distingue la viabilidad del riesgo por resultados y no explica que desmarcar el core **no** apaga su filtro. El usuario interpreta entonces que el checkbox controla el cálculo y que las velas intervienen en el resultado, cuando en realidad el 002 se calcula siempre como `GATE` y solo usa estados financieros anuales y la fecha de `earnings`.

## What Changes

- Reemplazar `CORES_INFO['002'].calculo` por una explicación completa y verificable del comportamiento vigente: variantes de Altman por SIC, umbrales exactos (`1.81/2.99`, `1.10/2.60`), exclusión de financieras, las 9 pruebas de Piotroski con mínimo 6 evaluables, las reglas de clasificación y los niveles de riesgo por resultados.
- Precisar `CORES_INFO['002'].peso` y `CORES_INFO['002'].participa` para distinguir los efectos de seleccionar y de no seleccionar el core: con selección aporta su puntaje al 25 % efectivo (cinco cores activos); sin selección sigue vetando `MARGINAL`/`NO_VIABLE` como `GATE` y no pondera.
- Agregar, solo en el modal del Core 002, un botón de ayuda compacto junto a «Cómo se calcula» que abra un panel con los bloques «Seleccionado» y «No seleccionado», cerrable con `Escape` y con retorno de foco. El botón queda fuera de `role="tablist"` para no alterar pestañas ni rejilla.
- Alinear `docs/EXPLICACION_CORES_Y_RANKING.md` con los textos de la UI, según exige la advertencia de `coresInfo.js:1-2`.
- Agregar pruebas del cliente para los textos y para el panel de ayuda (apertura, cierre con `Escape`, foco y ausencia en otros cores).

**Sin cambios de comportamiento:** no se modifican umbrales, bandeos del F-Score, reglas de veto ni el cálculo en `fundamentalCore.js`. Los documentos `FUNDAMENTAL_CORE_EXPLICACION*` quedan fuera de este change; sus inexactitudes se tratarán por separado.

## Capabilities

### New Capabilities

- `explicacion-core-002`: Explicación verificable del cálculo del Core 002 y del efecto de seleccionarlo en la interfaz de consulta por core.

### Modified Capabilities

- `presentacion-frontend-react`: La consulta de resultados por core SHALL ofrecer para el Core 002 una explicación detallada de su cálculo y un panel de ayuda sobre el efecto de la selección, sin alterar las pestañas existentes.

## Impact

- **Endpoints afectados:** ninguno. No cambia el contrato HTTP ni el cuerpo de respuestas; solo cambian textos estáticos del cliente y documentación.
- **Archivos de código:** `client/src/services/coresInfo.js`, `client/src/components/CoreResultsModal.jsx`.
- **Documentación:** `docs/EXPLICACION_CORES_Y_RANKING.md`.
- **Pruebas:** especificaciones nuevas del cliente (`client/src/**/*.spec.jsx`) con Vitest + Testing Library.
- **Dependencias:** ninguna nueva; se reutiliza `lucide-react` ya presente en `client/package.json`.
- **Compatibilidad:** no ruptura. El botón nuevo se renderiza condicionalmente y no modifica `pestanas`, `visible` ni `gridTemplateColumns`.
- **Evidencia IA/manual:** la redacción y el código los genera asistencia de IA; la revisión y ejecución de pruebas por parte del equipo se registrará como verificación manual, sin atribuir a IA ni a humano trabajo no realizado.
