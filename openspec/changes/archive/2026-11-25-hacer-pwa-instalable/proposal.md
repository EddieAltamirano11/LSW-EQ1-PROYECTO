# Proposal

## Why

Hoy el cliente de Los Eddies se abre desde una pestaña del navegador. Hacerlo instalable permitirá abrir el mismo cliente desde un icono en el escritorio o la pantalla de inicio.

## What Changes

- Publicar la identidad de Los Eddies, sus iconos y la URL de arranque mediante un manifiesto web para que el navegador pueda instalar el cliente React y abrirlo en una ventana independiente.
- Usar la opción nativa de instalación en Chrome y Edge de escritorio, Chrome para Android y Safari para iPhone. Documentar el paso que corresponde a cada plataforma.
- Preparar el build para la raíz de Cloudflare Pages y para `/dashboard/` cuando Express sirva `client/dist`.
- Mantener el acceso, el escáner, el portafolio y las órdenes en los flujos de red vigentes, tanto en la aplicación instalada como en una pestaña.

## Capabilities

### New Capabilities

- `instalacion-pwa` cubre la instalación del cliente React, su arranque desde el sistema operativo y el acceso a sus recursos públicos en cada ruta de publicación.

### Modified Capabilities

## Impact

- Cliente React/Vite en `client/`, publicación de recursos estáticos y documentación de instalación y verificación en `README.MD`.
- Superficie HTTP web afectada en `GET /` de Cloudflare Pages y `GET /dashboard/` de Express cuando exista el build, con nuevas rutas públicas para el manifiesto y los iconos bajo la base correspondiente. Se preservan el descriptor `GET /` de Express, su pantalla pública `GET /login` y los contratos de `/api/v1` y `/api/v2`, incluida la emisión real al broker.
- La evidencia registrará el build y los resultados de instalación por plataforma. Identificará por archivo o actividad el trabajo asistido por IA y el trabajo manual acreditado, con responsable y herramienta cuando consten.
