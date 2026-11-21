# Tasks

## 1. Pruebas primero

- [x] 1.1 Escribir pruebas backend que fallan para `role` y `effectiveWeight`: core seleccionado, dependencia, filtro, no calculado y síntesis.
- [x] 1.2 Escribir pruebas de componente que fallan para la consulta por core en sus cuatro estados (sin evaluar, cargando, error y con datos), y comprobar que el botón no cambia la selección.

## 2. Implementación

- [x] 2.1 Asignar `role` y `effectiveWeight` en el orquestador del screener, a partir de la selección y de los pesos de la confluencia.
- [x] 2.2 Mover `CoreResult` y `CoreDetail` a módulos propios y crear el descriptor de "Cómo se calcula" de cada core.
- [x] 2.3 Agregar al selector el botón de cada core y las filas de 004 y 007.
- [x] 2.4 Crear el modal con las pestañas Tabla y Cómo se calcula, accesible y adaptable a móvil, conectado con los resultados del Dashboard.
- [x] 2.5 Eliminar la rama sin uso `hideAssetList = false` del panel.

## 3. Contrato, verificación y evidencia

- [x] 3.1 Documentar `role` y `effectiveWeight` en `spec/openspec.yaml` y en el ejemplo de Postman, y explicar la participación de cada core en `docs/EXPLICACION_CORES_Y_RANKING.md`.
- [x] 3.2 Ejecutar las pruebas y el build, revisar en escritorio y móvil, y registrar la evidencia.
- [x] 3.3 Crear el `REPORT-DrFIC.md` del change y correr `openspec validate detalle-de-cores-en-modal` cuando el CLI esté disponible.
