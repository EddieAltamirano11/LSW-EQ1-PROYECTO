# Evidencia SDD del módulo de Portafolio

Cambio `add-portfolio-module`, verificado el 10 de noviembre de 2026.

## Antes y después

| Área | Antes | Después |
| --- | --- | --- |
| Cliente React | El dashboard mostraba el escáner y el flujo de ejecución de coberturas. | La pestaña Portafolio abre una vista de consulta con cuenta, posiciones y coberturas guardadas. Al volver al dashboard se conserva el estado del escáner. |
| Cuenta y posiciones | Las consultas habituales podían devolver saldos simulados o arreglos vacíos como respaldo. | La vista solicita `strict=true`. Los datos confirmados se muestran por separado de los errores de cada consulta. Un cero confirmado se conserva y una posición vacía requiere una lectura exitosa. |
| Coberturas guardadas | El listado estaba disponible en la API. | La vista consulta el mismo listado con `x-database-selection` y muestra los registros tal como se identifican en MongoDB o Supabase. |

## Verificación local

| Comprobación | Resultado |
| --- | --- |
| `npm test` | 76 pruebas aprobadas. Incluye el contrato HTTP de Portafolio en v1 y v2 y los adaptadores de Alpaca, Webull e IBKR con respuestas controladas. |
| `python -B -m unittest discover -s test -p portafolio_puentes_test.py` | Dos pruebas aprobadas con Python 3.12. Se sustituyeron los clientes SDK por respuestas controladas para verificar selección de cuenta, datos confirmados y fallo de conexión. |
| `npm --prefix client run build -- --configLoader runner` | Compilación de producción aprobada. El cargador predeterminado de Vite falló con «Acceso denegado» al intentar resolver su configuración desde un directorio superior en Windows. |
| OpenAPI y Postman | La prueba de referencias del OpenAPI publicado pasó. El generador ejecutado con `--portafolio-only` produjo JSON válido y una comparación estructural con la versión anterior confirmó que conservó los ejemplos históricos. |
| Chromium con Playwright | Verificado a 1280 y 360 px con solicitudes interceptadas. La prueba confirmó selección inicial de Dashboard, navegación con puntero y teclado, ausencia de desbordamiento horizontal, conservación de los filtros, activo y modo de órdenes, y resultado de una cobertura controlada. |
| Estados de Portafolio | Con las mismas respuestas controladas se verificaron los tres brokers y las dos bases, cero, valores ausentes, dos contratos con el mismo símbolo, listas vacías, fallo parcial, `401`, actualización con una respuesta anterior demorada, cierre de sesión en carga y acceso de demostración sin conexión. |

Para repetir la comprobación en navegador, compila el cliente y sirve `client/dist` en local. Inicia una sesión de prueba con destino local. Intercepta `GET /api/v2/broker/account?strict=true`, `GET /api/v2/broker/positions?strict=true` y `GET /api/v2/hedging` con los formatos de OpenAPI. Comprueba primero la cuenta con efectivo cero y dos posiciones con el mismo símbolo. Devuelve luego `503` para posiciones, `401` para cuenta y arreglos vacíos para ambos listados en intentos separados. Demora una respuesta, pulsa «Actualizar» y completa antes la consulta nueva. Regresa a Dashboard para cambiar de broker o base y vuelve a Portafolio. La prueba de ejecución intercepta el `POST /api/v2/hedging/auto-collar` y responde localmente con `201`.

## Integración de solo lectura

Se inició `src/app.js` en un puerto local efímero con la configuración existente. MongoDB se conectó con creación automática e indexación desactivadas. Los SDK de los puentes se instalaron en un directorio temporal de pruebas a partir de `requirements.txt`. La verificación registró estados HTTP y comprobaciones de formato. Todas las peticiones a brokers y bases fueron de consulta.

| Origen | Resultado contra el servicio configurado |
| --- | --- |
| Alpaca | Cuenta y posiciones respondieron `200` con los formatos estrictos al verificar el broker por separado. Una prueba simultánea con los tres brokers devolvió `503` para la cuenta de Alpaca. Los puentes síncronos pueden demorar otras lecturas. |
| Webull | Cuenta y posiciones respondieron `200`. El SDK encontró la cuenta configurada mediante el listado de cuentas. |
| IBKR | Ambas consultas devolvieron `503`. La comprobación TCP recibió conexión rechazada. La selección de cuenta y el filtrado de posiciones se verificaron con el puente controlado. |
| MongoDB | `GET /api/v2/hedging` devolvió `200` con `X-Active-Database: mongodb` y filas compatibles con la vista. |
| Supabase | `GET /api/v2/hedging` devolvió `200` con `X-Active-Database: supabase` y filas compatibles con la vista. |

Para repetir las lecturas, usa la carpeta «Portafolio (solo lectura)» de cualquiera de las colecciones Postman. Configura `baseUrl` para la API local, `tokenPortafolio` con el JWT obtenido desde `/auth/login`, y selecciona `brokerPortafolio` y `baseDatosPortafolio`. Ejecuta las dos peticiones de broker para cada proveedor y la de coberturas para cada base. Para probar v2 usa una URL base terminada en `/api/v2`. Un `503` debe aparecer como consulta no disponible en la vista.

Para el mapeo del proveedor se consultaron los formatos de [cuenta de Webull](https://developer.webull.com/apis/docs/reference/account-balance/) y [posiciones de Webull](https://developer.webull.com/apis/docs/reference/account-position/), así como las operaciones de lectura de [ib_insync](https://ib-insync.readthedocs.io/_modules/ib_insync/ib.html).

## Autoría

- El usuario definió que Portafolio sería una pestaña independiente con ambas fuentes y estableció la convención de nombres en español y `camelCase`.
- Codex implementó el cambio con asistencia de IA y ejecutó las verificaciones registradas con Node.js, Python, Vite, Playwright y OpenSpec.
- La autoría manual acreditada queda pendiente de evidencia. La autoría de las integraciones preexistentes se considera sin documentar para este cambio.
