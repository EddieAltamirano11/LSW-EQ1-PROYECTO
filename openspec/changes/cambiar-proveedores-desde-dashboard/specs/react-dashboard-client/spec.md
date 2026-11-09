# Contexto del panel React

## Purpose

Permitir que una persona cambie los destinos de broker y persistencia desde el panel de coberturas y que las solicitudes del panel usen los destinos elegidos.

## ADDED Requirements

### Requirement: Selección independiente en el panel

El panel React SHALL ofrecer selectores «Base de datos» con MongoDB y Supabase y «Broker» con Webull, Alpaca e IBKR en la fila de contexto. Ambos SHALL mostrar su valor vigente y funcionar con teclado y puntero en escritorio y móvil. Cada cambio válido SHALL aplicarse de inmediato dentro de la sesión React, conservar el otro destino y el modo de órdenes, y mantenerse al recargar mientras se restaure esa sesión. Al salir SHALL descartarse junto con la sesión.

#### Scenario: Elegir destinos desde el panel
- **WHEN** la sesión muestra MongoDB y Webull y la persona cambia el broker a Alpaca y después la base a Supabase
- **THEN** cada cambio actualiza solo su selector, conserva la sesión y el modo de órdenes y no inicia una ejecución de cobertura ni solicita un nuevo login

#### Scenario: Restaurar y cerrar la sesión
- **WHEN** la persona recarga después de cambiar los destinos y después pulsa «Salir»
- **THEN** el panel recargado muestra ambas selecciones guardadas y al salir se descarta el contexto con la sesión, de modo que un nuevo ingreso usa las opciones de ese ingreso

### Requirement: Escaneo con la selección vigente

Cada `GET /api/v2/market/scanner/top-collars` del panel SHALL enviar el broker vigente y la selección vigente de base como contexto HTTP. Cambiar de broker SHALL volver a escanear con los filtros actuales. El panel SHALL permitir actuar sobre los candidatos del nuevo escaneo cuando estén disponibles. Si la API falla o la respuesta no sirve, SHALL conservar el respaldo de cálculo local sin presentarlo como una respuesta del broker.

#### Scenario: Actualizar el ranking tras cambiar de broker
- **WHEN** se cambia de Webull a IBKR con Top 10 y vencimiento de 60 días
- **THEN** la nueva consulta envía `broker=IBKR` con los filtros existentes y el panel muestra sus candidatos al recibir una respuesta JSON válida

#### Scenario: Llegada tardía de un escaneo anterior
- **WHEN** la persona cambia de broker con un escaneo pendiente y la respuesta anterior llega después del cambio
- **THEN** sus candidatos no sustituyen el ranking del broker vigente ni quedan disponibles para ejecutar con él

#### Scenario: Fallo del escaneo remoto
- **WHEN** el escaneo del broker vigente falla por red, por un error HTTP o por una respuesta que no se puede usar
- **THEN** el panel conserva el contexto seleccionado y puede mostrar el respaldo de cálculo local como tal

### Requirement: Ejecución y persistencia coherentes con la selección

Cuando la persona solicite una cobertura, el panel SHALL enviar el broker y la base vigentes mediante los encabezados de selección admitidos por `POST /api/v2/hedging/auto-collar` y por su respaldo `POST /api/v1/hedging/auto-collar`. SHALL conservar el significado de `executeOrders`, los contratos de las respuestas y el tratamiento de errores. Mientras exista una ejecución pendiente, incluidos los reintentos y la renovación de token, ambos selectores SHALL permanecer deshabilitados. El resultado SHALL identificar los destinos usados para esa solicitud.

#### Scenario: Usar la nueva base aunque el token se emitiera para otra
- **WHEN** el JWT se emitió con MongoDB y se solicita una cobertura con Alpaca y Supabase seleccionados
- **THEN** la petición envía `x-broker-selection: ALPACA` y `x-database-selection: supabase` y el servidor resuelve esos destinos, también si la operación se solicita por el respaldo v1

#### Scenario: Renovar el token durante una ejecución
- **WHEN** el flujo existente necesita `POST /api/v1/auth/login` para renovar el token
- **THEN** envía la base seleccionada en `databaseTarget`, usa el token recibido para continuar y conserva ambos destinos. Si no consigue un token utilizable, el panel mantiene las selecciones y comunica el fallo de la ejecución por su flujo vigente

#### Scenario: Terminar una ejecución pendiente
- **WHEN** una cobertura está pendiente y la persona intenta cambiar el contexto
- **THEN** los controles impiden cambiar los destinos hasta que terminen todas las ejecuciones pendientes, y el detalle de cada respuesta identifica los destinos de su solicitud tanto si tiene éxito como si devuelve un error
