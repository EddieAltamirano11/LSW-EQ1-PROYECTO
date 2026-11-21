# Tasks

## 1. Pruebas primero

- [x] 1.1 Agregar al cliente Vitest, React Testing Library y jsdom con versiones exactas, y el script `test` en `client/package.json`.
- [x] 1.2 Escribir las pruebas que fallan:
  - Backend, en `test/strategyScreener.v2.test.js`: `exclusionType` para veto, sin collar y datos insuficientes.
  - Cliente: el mapeo devuelve el collar real con costo neto normalizado, retorno y hora de cotización, o el teórico marcado como tal.
  - Componente: fila con collar real, fila teórica y fila excluida sin collar.

## 2. Implementación

- [x] 2.1 Asignar `exclusionType` en `strategyScreener.service.js`, donde se decide el motivo de exclusión.
- [x] 2.2 Crear el módulo de mapeo del collar por fila: origen, contratos, débito o crédito normalizado, retorno sobre el spot y hora de cotización.
- [x] 2.3 Usar el mapeo en la tabla del ranking:
  - marca «Real · Core 004» o de valor teórico;
  - probabilidad que indica que no aplica en las filas reales;
  - tipo de exclusión y su causa en la columna de cores.

## 3. Contrato, verificación y evidencia

- [x] 3.1 Documentar `exclusionType` en `spec/openspec.yaml` y actualizar el ejemplo del screener en las colecciones Postman.
- [x] 3.2 Ejecutar `npm test`, las pruebas del cliente y el build. Revisar en escritorio y móvil, antes y después de evaluar los cores, y registrar la evidencia.
- [x] 3.3 Crear el `REPORT-DrFIC.md` del change (resumen ejecutivo, diagrama C4, lógica integrada, registro de tareas con fecha y riesgos por etapa) y correr `openspec validate core-004-en-ranking` cuando el CLI esté disponible.
