# Tareas

## 1. Selectores y sesión React

- [x] 1.1 Reutilizar las opciones del acceso y convertir los indicadores del panel en selectores etiquetados. Actualizar y persistir los destinos mediante `App.jsx`. Verificar con teclado y puntero en escritorio y a 360 px que cambiar uno conserva el otro y el modo de órdenes, que ambos se restauran al recargar y que salir descarta la sesión.
- [x] 1.2 Documentar en `README.MD` el cambio desde el panel, su efecto en la sesión y las solicitudes, y la diferencia con la pantalla pública `/login`. Comprobar que los pasos documentados se pueden seguir desde las dos pantallas.

## 2. Escaneo y ejecución con el contexto elegido

- [x] 2.1 Enviar el broker en la consulta del escáner y la base mediante `x-database-selection`. Volver a escanear al cambiar de broker, invalidar resultados obsoletos y distinguir el respaldo local. Con respuestas controladas, verificar los filtros conservados, una respuesta anterior retrasada y el respaldo ante error HTTP o de red.
- [x] 2.2 Enviar ambos encabezados de selección en auto-collar v2/v1, usar la base capturada en la renovación y guardar el nuevo token en la sesión vigente. Verificar con solicitudes interceptadas el cambio de MongoDB a Supabase con un JWT emitido para MongoDB, la ruta de respaldo v1, la renovación y el cierre de sesión mientras se renueva.
- [x] 2.3 Mantener los selectores deshabilitados durante todas las ejecuciones pendientes y asociar cada resultado a su contexto. Con respuestas simuladas, comprobar los modos Real y Simulado, la ausencia de envíos de auto-collar al cambiar un selector, el bloqueo hasta finalizar las ejecuciones y el detalle ante éxito o error. Usar solicitudes interceptadas para ambos modos.
- [x] 2.4 Contrastar las solicitudes del cliente con `spec/openspec.yaml` y los ejemplos Postman de las rutas consumidas. Conservar los métodos, parámetros y formatos vigentes y comprobar la precedencia de los encabezados con `test/context.unit.test.js` y `test/login.session.test.js`.

## 3. Verificación integrada

- [x] 3.1 Ejecutar `npm --prefix client run build` y `node --test test/context.unit.test.js test/login.session.test.js test/scanner.v2.test.js`.
