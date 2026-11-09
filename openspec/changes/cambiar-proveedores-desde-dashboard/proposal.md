# Propuesta

## Why

El panel de coberturas muestra la base de datos y el broker elegidos al ingresar a React, pero esos indicadores son de solo lectura. La persona necesita cambiar cualquiera de los dos directamente en el panel para usarlo en sus próximas operaciones sin volver a ingresar.

## What Changes

- Convertir los indicadores «Base de datos» y «Broker» del panel en selectores independientes con las opciones que ya ofrece el acceso React. Mostrar siempre los destinos seleccionados.
- Aplicar cada cambio al contexto del panel y guardarlo junto con la sesión React para restaurarlo al recargar. Al cambiar de broker, actualizar el escáner con los filtros en uso.
- Usar la selección vigente al enviar el escaneo y al ejecutar una cobertura. Cambiar un destino por sí solo no emite órdenes. Mantener fijos los destinos mientras haya una ejecución pendiente.

## Capabilities

### New Capabilities

- `react-dashboard-client` cubre la selección y el uso de los destinos de broker y persistencia durante una sesión del panel React.

### Modified Capabilities

## Impact

- El alcance se concentra en el estado de sesión de `client/src/App.jsx`, los controles y solicitudes de `client/src/components/Dashboard.jsx` y las opciones compartidas con el acceso React. Se documentará el flujo en `README.MD`.
- Se ajusta el consumo de `GET /api/v2/market/scanner/top-collars` y `POST /api/v2/hedging/auto-collar`, incluido su respaldo `POST /api/v1/hedging/auto-collar` y la renovación mediante `POST /api/v1/auth/login`. Se reutilizan el contrato HTTP y las reglas de resolución de destinos de la API.
- `inicio-sesion` rige la pantalla pública `/login`, donde elegir otra base después de ingresar sigue siendo parte del flujo de un nuevo acceso. Este cambio corresponde al panel del cliente React, que ya conserva su propia sesión.
