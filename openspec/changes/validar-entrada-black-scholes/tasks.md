# Tasks

## 1. Constitución y evidencia del proceso SDD

- [x] 1.1 Completar `openspec/config.yaml` con contexto, evaluación de estructura y reglas de trazabilidad IA/manual; verificar que el YAML se interpreta y que `openspec instructions` incorpora las reglas.
- [x] 1.2 Crear `docs/EVIDENCIA_SDD_BLACK_SCHOLES.md` y enlazarlo desde `README.MD`, incluyendo referencia previa, comparación de estructura, casos observados y atribución real; comprobar rutas y separar explícitamente la optimización manual pendiente.

## 2. Validación aislada de Black-Scholes

- [x] 2.1 Agregar pruebas HTTP de compatibilidad y de los escenarios de entrada/salida inválida en `test/black-scholes.validation.test.js`; ejecutarlas antes de modificar el controlador para comprobar que detectan los defectos originales.
- [x] 2.2 Crear el módulo de validación y conectarlo exclusivamente al controlador Black-Scholes, conservando el servicio compartido; verificar que las pruebas de validación pasan y que los resultados PUT/CALL coinciden exactamente con las referencias previas.
- [x] 2.3 Actualizar únicamente el contrato Black-Scholes en `spec/openspec.yaml` con validaciones, compatibilidad, valores predeterminados y error `400`; comprobar el YAML y su publicación en `/spec.json` mediante la prueba HTTP.

## 3. Sincronización acotada de Postman

- [x] 3.1 Agregar `--black-scholes-only` al generador existente para sincronizar exclusivamente las dos colecciones locales desde el ejemplo HTTP, con descripción y comprobaciones de respuesta; ejecutar el modo, comprobar que el resto de solicitudes coincide semánticamente con Git y que una segunda ejecución no cambia los archivos.
- [x] 3.2 Documentar el comando de sincronización y las comprobaciones reproducibles en la evidencia, y verificar que las peticiones y el contrato describen el mismo comportamiento.

## 4. Verificación integral del cambio

- [x] 4.1 Ejecutar la suite local completa, incluyendo sesión, publicación del login, prefijo alternativo y volatilidad implícita; validar el cambio con `openspec validate validar-entrada-black-scholes --strict` y confirmar que `quant.service.js` permanece idéntico a la referencia. Resultado: 32/33; el fallo preexistente de sesión se reprodujo y documentó, y ambos flujos de sesión se comprobaron por HTTP con su encabezado actual.
- [x] 4.2 Registrar los resultados reales en la evidencia, revisar el diff y comprobar que las tareas están completas sin commit, push ni archivado automático.
