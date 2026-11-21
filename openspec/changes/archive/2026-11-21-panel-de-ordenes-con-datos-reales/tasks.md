# Tasks

## 1. Pruebas primero

- [x] 1.1 Escribir las pruebas de componente que fallan (Vitest):
  - vista previa del Auto-Collar con el collar del ranking, y del Protective Put con su contrato;
  - activo sin vista previa, con las coberturas deshabilitadas;
  - aviso de éxito con los datos de la respuesta, y modal con `PARTIALLY_EXECUTED`;
  - un solo envío ante un error de red, y error de cores mostrado sin reintento.

## 2. Implementación

- [x] 2.1 Agregar la vista previa real a la boleta:
  - Auto-Collar: el collar del ranking o la vista previa del backend, rotulado «Collar» con su costo neto;
  - Protective Put: la recomendación con su `contractSymbol`;
  - eliminar el `activeCandidate` fabricado y deshabilitar las coberturas sin vista previa.
- [x] 2.2 Construir los avisos de éxito con la respuesta y mostrar en el modal `PARTIALLY_EXECUTED` y el estado de cada orden.
- [x] 2.3 Quitar el reintento "legacy" de `StrategyScreenerPanel.jsx` y el reintento v2→v1 de `handleExecuteCollar`. Ante un error de red, indicar que se revisen las órdenes en el broker.

## 3. Verificación y evidencia

- [x] 3.1 Ejecutar las pruebas del cliente y el build. Revisar en escritorio y móvil la vista previa, el activo sin datos, el aviso de éxito, el `409` y el error de cores, y registrar capturas o notas como verificación manual.
- [x] 3.2 Crear el `REPORT-DrFIC.md` y correr `openspec validate panel-de-ordenes-con-datos-reales --strict`.
