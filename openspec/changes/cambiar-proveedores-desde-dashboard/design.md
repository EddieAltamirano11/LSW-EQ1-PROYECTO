# Diseño

## Context

`LoginView.jsx` guarda los destinos elegidos al entrar. `App.jsx` restaura `hedging_quant_session`, y `Dashboard.jsx` usa esa sesión para mostrar los distintivos y hacer las solicitudes. Los encabezados actuales `x-database-target` y `x-broker` del cliente difieren de los que leen los middlewares. La base del JWT puede prevalecer cuando el cliente usa el nombre equivocado del encabezado, aunque el panel muestre otra base.

## Goals / Non-Goals

- Mantener una sola fuente para los destinos mostrados, enviados y restaurados por React.
- Limitar el cambio al panel React y a los datos de opciones que comparte con su acceso. Fuera del alcance quedan el acceso público `/login`, la precedencia del servidor, la migración de datos entre bases, la configuración de credenciales y el comportamiento de los adaptadores de broker.

## Decisions

1. **Reutilizar la sesión que controla `App`.** Convertir los distintivos en selectores nativos etiquetados, con el estilo y los iconos de la fila. Compartir los valores de opción con `LoginView` para evitar divergencias. `App` fusionará los cambios de selección y las renovaciones del token en la sesión actual, y será el único lugar que persista esa sesión. Una copia de los destinos en el dashboard obligaría a sincronizar el estado visible, el login y el almacenamiento.
2. **Usar la selección por solicitud que ya ofrece la API.** El escáner obtiene el broker de `?broker=` y recibe `x-database-selection` como contexto. Cambiar solo la base no necesita recalcular el ranking, porque el escáner no consulta los repositorios de persistencia. Auto-collar v2 y su respaldo v1 usarán `x-database-selection` y `x-broker-selection` con el mismo broker en el cuerpo. La API resuelve esos encabezados antes que el JWT o el cuerpo, y sus rutas v1/v2 comparten los controladores de autenticación y cobertura. Volver a emitir el JWT al cambiar de base añadiría una autenticación innecesaria y acoplaría los selectores al flujo de credenciales.
3. **Vincular el ranking al escaneo vigente.** Reusar el flujo automático de filtros y añadir el broker como disparador. Invalidar el ranking anterior al cambiar de broker, abortar o ignorar respuestas obsoletas y permitir las acciones por candidato cuando haya un resultado vigente. Mantener el respaldo local, identificado como tal cuando el frontend lo use. Esperar a que la persona pulse Escanear dejaría un ranking del broker anterior bajo el nuevo selector.
4. **Capturar el contexto al iniciar cada ejecución.** Reusar los mismos destinos para el primer envío, el respaldo v1, la renovación existente y el detalle de resultado. Bloquear los selectores hasta que se resuelvan todas las ejecuciones pendientes, sin reutilizar como indicador global el estado de una sola fila. Dejar los controles activos durante ese intervalo permitiría mostrar un destino nuevo mientras una operación todavía se procesa con el anterior.

## Risks / Trade-offs

- Una respuesta tardía podría reemplazar el ranking correcto o retirar su estado de carga. Aplicar la comprobación de vigencia también al respaldo local, los errores y el final de la carga.
- Guardar un objeto capturado antes de renovar el token puede restaurar selecciones antiguas o reactivar una sesión cerrada. Fusionar el token con el estado vigente solo si sigue siendo la misma sesión y nunca persistir credenciales adicionales.
- Elegir un destino puede dar la impresión de que su conexión se ha verificado. Mostrarlo como selección y conservar las validaciones y los errores de las operaciones reales, sin añadir una comprobación de disponibilidad al selector.

## Migration Plan

Compilar y publicar el cliente mediante el flujo habitual. Se conserva la clave y el formato de la sesión React, por lo que las sesiones guardadas siguen siendo utilizables y el cliente anterior puede leerlas si se revierte la publicación. Los repositorios y el contrato HTTP siguen siendo los mismos.
