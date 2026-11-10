# Módulo de Portafolio

## Why

El dashboard permite encontrar y ejecutar coberturas, pero para revisar el saldo, las posiciones abiertas y las estrategias guardadas hay que consultar la API por separado. Una pestaña de Portafolio permite consultar esos datos sin añadir tablas al dashboard de escaneo.

## What Changes

- Agregar las pestañas «Dashboard» y «Portafolio» a la sesión React. Portafolio será una vista independiente de solo lectura, con acceso de vuelta al escáner.
- Mostrar dos secciones. La primera contiene la cuenta y las posiciones abiertas del broker seleccionado (Webull, Alpaca o IBKR). La segunda contiene las estrategias guardadas en la base de datos seleccionada (MongoDB o Supabase).
- Diferenciar una consulta exitosa sin posiciones o estrategias de un fallo de origen. Mostrar los datos disponibles de cada consulta aunque otra falle y ofrecer una actualización manual.
- Incorporar un modo explícito de consulta de broker para el módulo. Ese modo devolverá datos confirmados por el proveedor configurado o informará que la consulta falló. Los clientes actuales conservarán su comportamiento por defecto.

## Capabilities

### New Capabilities

- `modulo-portafolio` — navegación al módulo, consulta de cuenta y posiciones confirmadas y presentación separada de las coberturas persistidas.

### Modified Capabilities

## Impact

- Cliente React. Se agrega navegación a una vista separada que reutiliza el servidor, la sesión y los destinos elegidos desde el dashboard. El flujo de escaneo y emisión de órdenes conserva su estado y sus solicitudes.
- API. La vista consumirá `GET /api/v2/broker/account` y `GET /api/v2/broker/positions` con `strict=true`, así como `GET /api/v2/hedging` con la base seleccionada. El modo nuevo se limita a las dos lecturas del broker, también disponibles mediante su enrutador compartido con v1. El listado de coberturas conserva su contrato.
- Verificación. Se documentarán las consultas en OpenAPI y en los ejemplos Postman pertinentes. La evidencia SDD registrará el antes y después, los responsables, la asistencia de IA y los resultados obtenidos, y acreditará trabajo manual solo cuando exista evidencia de autoría.
