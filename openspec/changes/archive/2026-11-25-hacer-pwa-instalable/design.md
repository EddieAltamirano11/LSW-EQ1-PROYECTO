# Design

## Context

`client/index.html` es la entrada del cliente React compilado por Vite. Ahora tiene un favicon embebido y carece de manifiesto. `client/src/App.jsx` selecciona Dashboard y Portafolio por fragmentos de URL y restaura la sesión del contexto del navegador. Cloudflare Pages publica el build en la raíz. `src/app.js` monta el mismo directorio `client/dist` como archivos estáticos en `/dashboard` cuando existe. En Express, `/` sirve el descriptor JSON y `/login` sirve una página independiente.

## Goals / Non-Goals

**Objetivo.** Usar el mismo build y la identidad institucional en las dos entradas del cliente, con una URL de arranque que use el flujo de sesión existente.

**Fuera de alcance.** Funcionalidad de mercado sin conexión, sincronización en segundo plano, notificaciones, distribución en tiendas y cambios al manejo de sesión de React.

## Decisions

### Usar el manifiesto y la instalación nativa

Agregar `client/public/manifest.webmanifest` y vincularlo desde `client/index.html` junto con el color de tema y el icono táctil. Declarar `name` y `short_name` como «Los Eddies», `display: standalone`, un `id` estable del mismo origen y colores tomados de la paleta institucional. Usar el símbolo del favicon actual como base para PNG de 192 y 512 píxeles, con una variante *maskable* para Android y un icono táctil para iPhone. El navegador usa esos recursos fuera de la interfaz React. [Especificación del manifiesto web](https://www.w3.org/TR/appmanifest/)

El menú del navegador cubre el flujo de instalación solicitado. Un control dentro del cliente dependería de la disponibilidad de `beforeinstallprompt` y requeriría un flujo adicional para Safari en iPhone. Un service worker tendría utilidad para una futura experiencia sin conexión y añadiría interceptación de solicitudes y gestión de versiones. La instalación por menú en Chrome prescinde de ese componente. [Criterios de instalación de Chrome](https://developer.chrome.com/blog/update-install-criteria) · [Instalación desde Safari en iPhone](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) · [Instalación desde Microsoft Edge](https://support.microsoft.com/es-es/edge/install-manage-or-uninstall-apps-in-microsoft-edge)

### Resolver los recursos desde la base de la SPA

Usar `base: './'` en `client/vite.config.js` y referencias compatibles con la base de Vite en el HTML. En el manifiesto, usar `./` como `start_url` y `scope`, con rutas de icono relativas al archivo. La entrada publicada en Express debe resolver primero a `/dashboard/` con barra final, de modo que el navegador cargue el manifiesto, los iconos y los bundles bajo ese prefijo. La navegación por hash permite reutilizar la misma entrada al cambiar de módulo. Una base absoluta por destino también resolvería los recursos correctamente y requeriría producir y distribuir dos builds. [Base pública de Vite 6](https://v6.vite.dev/guide/build#public-base-path) · [Procesamiento del manifiesto web](https://www.w3.org/TR/appmanifest/)

En Cloudflare Pages, verificar que los recursos se sirven antes de aplicar el fallback de la SPA. Si `/* /index.html 200` de `client/public/_redirects` intercepta el manifiesto, los iconos o los bundles, retirar esa regla general y utilizar el fallback de SPA nativo de Pages. Limitar el ajuste a la publicación estática y probar los destinos de API usados por el cliente. En Express, reutilizar el montaje actual de `client/dist` y ajustar su entrega solo si la prueba descubre un problema con la barra final o el tipo de contenido. [Entrega de archivos y fallback de Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/) · [Orden de reglas en `_redirects`](https://developers.cloudflare.com/pages/configuration/redirects/)

### Mantener la comunicación directa con la API

La PWA comparte la misma entrada, autenticación y servicios de React que una pestaña. El código lee la sesión que exista en el contexto de esa instalación y, si falta o venció, abre el formulario habitual. El `start_url` carece de tokens y datos de la cuenta. Las solicitudes conservan el servidor de API configurado, la versión y los datos que ya envían. El acceso de presentación «Acceso Rápido Demo» es una función previa del cliente y queda fuera de la instalación.

El Auto-Collar y el Protective Put ya muestran un aviso de resultado desconocido por error de red. La orden de acciones actualmente muestra el error genérico del `fetch`, aunque `presentacion-frontend-react` pide el aviso de resultado desconocido para una emisión. La validación de esta propuesta conserva el aviso existente en las coberturas y comprueba que la instalación no introduce reenvíos en ninguna modalidad. Corregir el mensaje de acciones corresponde al flujo de órdenes.

## Risks / Trade-offs

- Un `200` con el HTML de la SPA puede ocultar la falta del manifiesto o un icono. Verificar el tipo y el contenido de la respuesta, además de abrir la URL inicial y los enlaces por hash en ambas bases.
- La ventana instalada puede usar un contexto de almacenamiento diferente al de la pestaña según el navegador. Verificar el primer arranque sin sesión y la persistencia que ofrece el flujo React dentro de la instalación. [Comportamiento de almacenamiento de las aplicaciones web de Safari](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/)
- Los menús de instalación dependen del navegador y del dispositivo. Registrar la versión y confirmar instalación y apertura desde el icono en la matriz de aceptación.

## Migration Plan

Validar el build en `localhost`, revisar los recursos con el emulador HTTPS local de Cloudflare Pages y verificar el montaje de Express con el mismo build. Si se publica el frontend, la reversión consiste en volver al build anterior y, si se ajustó la regla de fallback, a su configuración anterior. La entrada de una instalación previa puede seguir guardada en el dispositivo y abrir la URL web mientras el navegador la conserve.
