# Tareas

## 1. Lecturas confirmadas del broker

- [x] 1.1 Incorporar la lectura estricta de cuenta y posiciones a los adaptadores de Alpaca, Webull e IBKR y a los comandos de lectura pertinentes de los puentes Python. Usar respuestas de prueba de los tres proveedores para verificar cuenta seleccionada, valores ausentes, cero confirmado, posiciones vacías confirmadas, tiempos de espera, errores de formato y respaldos existentes.
- [x] 1.2 Conectar `strict=true` en los controladores de cuenta y posiciones mediante los enrutadores compartidos de v1/v2. Verificar con `node:test` el contexto de broker, los estados `200`, `400`, `401`, `502` y `503`, el cuerpo de error sin detalles internos y la compatibilidad de las llamadas habituales.
- [x] 1.3 Documentar las dos consultas estrictas en `spec/openspec.yaml` y añadir ejemplos de Portafolio en las colecciones Postman de Render y Cloudflare con token de variable y selección de broker. Verificar que el OpenAPI publicado resuelve sus referencias y que las colecciones conservan los ejemplos históricos y son JSON válido.

## 2. Navegación y consultas en React

- [x] 2.1 Agregar las pestañas «Dashboard» y «Portafolio» al cliente con sesión y crear la vista separada `VistaPortafolio.jsx`. Verificar que se puede navegar con teclado y puntero, que se conserva el estado del escáner al regresar y que el dashboard sigue siendo la vista inicial al entrar.
- [x] 2.2 Mostrar cuenta y posiciones con las lecturas estrictas, y coberturas con `GET /api/v2/hedging` en la base seleccionada. Verificar con respuestas controladas de los tres brokers y ambas bases los encabezados, valores faltantes, cero, listas vacías, posiciones con símbolo compartido y estrategias con identificadores persistidos de cada base.
- [x] 2.3 Implementar «Actualizar», carga y errores independientes, descarte de consultas obsoletas, sesión inválida y acceso de demostración sin conexión. Verificar un fallo parcial, un `401`, un cambio de destino, una actualización con respuestas tardías y el cierre de sesión durante la carga.

## 3. Verificación integrada y evidencia

- [x] 3.1 Ejecutar `npm test` y `npm --prefix client run build`. Comprobar la pestaña en escritorio y a 360 px, y revisar el regreso al dashboard, la selección de destinos y el flujo de cobertura con respuestas controladas. Revisar que las funciones, métodos, parámetros y variables agregados para Portafolio tengan nombres descriptivos en español y `camelCase`, con la convención de JSX para `VistaPortafolio`.
- [x] 3.2 Verificar el flujo de consulta contra los entornos de broker y base que estén configurados y disponibles. Registrar qué combinaciones se verificaron mediante integración y cuáles mediante respuestas controladas, con pasos reproducibles y resultados, sin emitir órdenes durante la verificación.
- [x] 3.3 Registrar evidencia SDD con el antes y después del flujo, responsables, herramientas y resultados de verificación. Comprobar que diferencia asistencia de IA, autoría manual acreditada y trabajo con autoría sin documentar.
