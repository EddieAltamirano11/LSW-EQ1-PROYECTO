# Diseño de Portafolio

## Context

`App.jsx` gestiona la sesión React y `Dashboard.jsx` mantiene el estado del escáner, el selector de destinos y las ejecuciones. Los enrutadores v1 y v2 comparten las rutas de broker y de coberturas. `GET /hedging` ya usa la base resuelta por el middleware y devuelve las filas de su repositorio. Las consultas actuales de broker pueden devolver valores de ejemplo o listas vacías de respaldo. Los puentes de Webull e IBKR también pueden sustituir campos ausentes antes de que lleguen a Node.js.

## Goals / Non-Goals

- Reutilizar los destinos de sesión, los adaptadores del broker y el listado de coberturas.
- Limitar las lecturas nuevas al módulo y el contrato estricto a las dos operaciones de broker. El modelo de datos, las operaciones de órdenes y las reglas de sesión existentes quedan fuera del alcance.

## Decisions

1. **Pestañas en el cliente autenticado.** Gestionar la vista activa en `App.jsx` y crear `VistaPortafolio.jsx` con el estilo del cliente. Mantener montado el escáner con su panel oculto e inactivo para navegación mientras se consulta Portafolio. Montar y consultar Portafolio al seleccionarlo. La selección de destinos sigue en el dashboard y Portafolio muestra los destinos vigentes que recibe de la sesión. Una sección dentro de `Dashboard.jsx` mezclaría los datos con el escáner. Un enrutador nuevo para dos vistas añadiría configuración de publicación en Express y Cloudflare Pages.
2. **Lecturas independientes con el contexto vigente.** Usar la misma URL base y el token de la sesión React. La sección de broker usa `x-broker-selection` y la de coberturas usa `x-database-selection`. El cliente valida el formato de cada respuesta y el broker de la respuesta estricta. Una actualización inicia una generación nueva de consultas. Cancelar o descartar las anteriores al actualizar, cambiar el contexto, salir de la pestaña o cerrar sesión. Mantener los estados de cuenta, posiciones y coberturas por separado permite presentar un resultado parcial. Una respuesta consolidada requeriría una ruta adicional y acoplaría la disponibilidad de ambos orígenes.
3. **Lectura estricta optativa en las rutas de broker.** Detectar `strict=true` en los dos controladores de lectura. Para este modo, comprobar el usuario resuelto por el middleware JWT y la selección explícita antes de consultar. Usar el cliente HTTP y los comandos de lectura existentes con un camino estricto acotado en cada adaptador. En Alpaca, diferenciar el fallo de una respuesta exitosa vacía. En Webull, extraer los campos de la respuesta de balance y validar que se consultó la cuenta configurada. En IBKR, comprobar la cuenta y el modo de conexión del puente, y conservar los campos que realmente devolvió el resumen. Los puentes pueden recibir una opción para emitir los campos confirmados y distinguir un fallo del proveedor de datos ilegibles, dejando sus salidas habituales como están. Usar límites de tiempo en las lecturas y evitar conexiones simultáneas con el mismo identificador de cliente de IBKR. Traducir los fallos a errores de la API con mensajes públicos breves. El formato estricto identifica el broker y se diferencia de la respuesta habitual, de modo que un servidor anterior no pase inadvertido como fuente de datos confirmados.
4. **Registros de estrategia independientes de las posiciones.** Leer `GET /hedging` y presentar los identificadores y estados devueltos por MongoDB o Supabase. MongoDB admite identificadores de portafolio textuales, mientras el repositorio Supabase persiste identificadores UUID. No deducir una clave común con la cuenta de broker a partir de `portfolioId`. El listado documentado ya resuelve ambas bases, así que reutilizarlo evita otro recurso y migraciones.

5. **Nombres del código de Portafolio.** Las funciones, métodos, parámetros y variables que se agreguen para el módulo en React, Node.js y los puentes Python usarán nombres descriptivos en español y `camelCase`, como `consultarPosicionesAbiertas` y `baseDatosSeleccionada`. El componente React se llamará `VistaPortafolio`, con inicial mayúscula según la convención de JSX. Al reutilizar código o datos se respetan los identificadores existentes y los nombres de los campos y encabezados del contrato HTTP.

## Risks / Trade-offs

- Un valor de respaldo puede parecer un saldo o una posición vigente → conservar el cero confirmado y representar los campos ausentes con `null`. Distinguir la consulta exitosa a un entorno paper trading de un resultado simulado de respaldo.
- Los comandos actuales del puente son síncronos → mantener tiempos de espera acotados y consultar solo al abrir la pestaña o actualizar manualmente. Verificar que las dos lecturas de IBKR funcionen en una misma apertura sin competir por la conexión.
- Una respuesta tardía puede cruzar cambios de contexto → descartar resultados y errores de solicitudes obsoletas antes de actualizar el estado de la vista.
- El login del proyecto es de demostración y las cuentas de broker se configuran en el servidor → tratar las lecturas como datos de la cuenta configurada para el entorno. El token sigue las reglas de la sesión existente.

## Migration Plan

Publicar primero la API con el contrato optativo y después compilar y publicar el cliente React mediante el flujo habitual. Se reutilizan las sesiones guardadas y los registros existentes. Para revertir, restaurar primero el cliente anterior y después retirar el modo estricto de la API.
