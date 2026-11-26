# Tasks

## 1. Manifiesto e identidad

- [x] 1.1 Crear los iconos PNG institucionales de 192 y 512 píxeles, la variante *maskable* y el icono táctil para iPhone. Comprobar las dimensiones de los archivos y revisar que el símbolo quede dentro de la zona segura de recorte del icono *maskable*.
- [x] 1.2 Incorporar `manifest.webmanifest` y vincularlo desde `client/index.html` con el color de tema y el icono táctil. Ejecutar `npm --prefix client run build` y comprobar en `client/dist` el enlace, el JSON, `display`, la identidad estable, la URL de arranque y los archivos de imagen referenciados.
- [x] 1.3 Documentar en `README.MD` el acceso al cliente, la instalación desde los menús de Chrome, Edge y Safari, y el requisito de conexión para consultas y órdenes. Verificar que los pasos correspondan a las opciones de instalación de cada plataforma prevista.

## 2. Publicación del mismo build en ambas bases

- [x] 2.1 Configurar la base relativa de Vite y verificar el mismo `client/dist` en `npm --prefix client run preview` y en Express con el build disponible. Comprobar `/dashboard`, `/dashboard/` y los enlaces `#/dashboard` y `#/portafolio`, además de obtener el manifiesto, sus iconos y los bundles en cada base con `200`, el tipo de contenido y el cuerpo esperados. Ajustar la entrega de Express solo si se detecta un fallo de resolución o de tipo de contenido.
- [x] 2.2 Verificar la raíz y los recursos estáticos en el emulador HTTPS local de Cloudflare Pages. Si la regla general de `client/public/_redirects` devuelve HTML para recursos estáticos, usar el fallback de SPA nativo de Pages. Comprobar la respuesta pública del backend configurado y verificar en Express `/`, `/login` y los descriptores de API v1 y v2.
- [x] 2.3 Documentar en `README.MD` los comandos de build y vista previa, la entrada de Express y una comprobación HTTP del manifiesto. Ejecutar los comandos documentados y verificar el tipo de contenido en la URL resultante.

## 3. Aceptación en navegador

- [x] 3.1 Instalar y abrir desde el icono en Chrome y Edge de escritorio, Chrome en Android y Safari en iPhone en un entorno de prueba con contexto seguro. Confirmar nombre, icono, modo `standalone` y URL de arranque. Comprobar también el arranque instalado desde `/dashboard/` en Chrome de escritorio y el uso normal desde una pestaña.
- [x] 3.2 Comprobar en la aplicación instalada el acceso sin sesión previa, la navegación entre Dashboard y Portafolio y una consulta con la API configurada. Ejecutar `npm --prefix client run test` y `node --test test/login.routes.test.js test/login.session.test.js`. Provocar un fallo de red en el navegador y bloquear los envíos de orden antes de que salgan al broker para comprobar el aviso existente de las coberturas y la ausencia de reenvíos tras volver a conectar en las tres modalidades.
- [x] 3.3 Registrar el antes y el después, la versión y el dispositivo de cada prueba, los comandos ejecutados y su resultado. Identificar responsables y herramientas por actividad, con atribución del trabajo asistido por IA, manual acreditado o de autoría sin documentar, y dejar explícitas las verificaciones pendientes.
