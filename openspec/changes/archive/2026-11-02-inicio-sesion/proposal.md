# Proposal

## Why

El proyecto ya permite seleccionar MongoDB o Supabase al solicitar una sesión JWT, pero solo ofrece una API y documentación Scalar, sin una pantalla de acceso. Se necesita un formulario que permita iniciar una sesión de demostración y elegir visualmente la base de datos desde un switch.

## What Changes

- Agregar una pantalla web de inicio de sesión en `/login`, con usuario, contraseña y botón para ingresar.
- Incorporar un selector tipo switch de dos opciones etiquetadas, MongoDB y Supabase, con MongoDB seleccionado inicialmente.
- Enviar la selección como `databaseTarget` al endpoint existente `POST <API_URL>/auth/login` y usar el token obtenido para consultar `GET <API_URL>/auth/session`.
- Mostrar estados de carga, errores recuperables y una confirmación de sesión con el usuario y la base seleccionada. Permitir volver al formulario para elegir otra base.
- Conservar el acceso de demostración, según la decisión del usuario: cualquier usuario y contraseña no vacíos permiten emitir un JWT; no se agregarán cuentas reales, registro ni validación de credenciales contra las bases.
- Mantener el token únicamente en memoria durante la visita y dejar claro que seleccionar una base no verifica su disponibilidad.

## Capabilities

### New Capabilities

- `inicio-sesion`: Pantalla de acceso de demostración con selección accesible de persistencia, integración con los endpoints JWT existentes y confirmación de la base elegida.

### Modified Capabilities

Ninguna. Actualmente no existen capacidades publicadas en `openspec/specs/`.

## Impact

- Incorporación de recursos HTML, CSS y JavaScript para el navegador y de su publicación desde `src/app.js`, reutilizando Express y el prefijo configurable `config.API_URL`.
- Consumo de los contratos existentes de autenticación y de la resolución de base de datos en `src/middlewares/databaseContext.middleware.js`, sin modificar su prioridad de encabezado, JWT y valor predeterminado.
- Actualización de `README.MD` con la ruta de acceso, el flujo y los límites del modo de demostración, más verificaciones focalizadas de la pantalla y su integración con la API.
- Sin nuevas dependencias de frontend, migraciones, cambios a repositorios de datos, lógica financiera ni integraciones de brokers. No se modifica el contrato REST existente ni se requiere regenerar la colección Postman por esta pantalla web.
