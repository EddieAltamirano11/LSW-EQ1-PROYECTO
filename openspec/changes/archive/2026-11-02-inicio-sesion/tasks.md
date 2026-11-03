# Tasks

## 1. Publicación de la pantalla y selector de base

- [x] 1.1 Crear `src/web/login.routes.js`, montarlo desde `src/app.js` y publicar `/login` y sus recursos en `/login/assets/`; verificar por HTTP que la pantalla y sus archivos responden correctamente y que el descriptor de la API y Scalar siguen accesibles.
- [x] 1.2 Crear `public/login/index.html` y `public/login/login.css` con campos etiquetados, contraseña oculta, regiones de mensajes y un switch visual basado en radios MongoDB/Supabase, omitiendo el aviso y la insignia de demostración en el formulario inicial conforme al diseño aceptado; verificar en navegador que MongoDB inicia seleccionado, que solo puede seleccionarse una base y que el teclado funciona con foco visible a 360 píxeles y en escritorio.
- [x] 1.3 Entregar el prefijo `config.API_URL` al HTML con escape de atributo y preparar su lectura desde `public/login/login.js`, exponiendo únicamente ese dato público; verificar la configuración predeterminada y un prefijo alternativo sin editar recursos del navegador.
- [x] 1.4 Agregar pruebas de publicación y configuración en `test/login.routes.test.js`, importando `src/app.js` sin ejecutar el arranque de conexiones; verificar con `node --test test/login.routes.test.js` la página, recursos, prefijo alternativo y conservación de rutas existentes.
- [x] 1.5 Documentar en `README.MD` cómo abrir `/login`, elegir la base y entender el alcance del modo de demostración; verificar que las instrucciones correspondan a la pantalla y al inicio habitual del servidor.

## 2. Login, confirmación de contexto y sesión temporal

- [x] 2.1 Implementar el envío del formulario en `public/login/login.js` con validación de usuario y contraseña, captura del destino y bloqueo de controles durante el intento; verificar en la red del navegador que mover el switch no envía solicitudes, las credenciales se conservan al moverlo y cada envío válido emite un único POST con `username`, `password` sin alterar y el `databaseTarget` elegido.
- [x] 2.2 Validar el JSON del login y consultar `/auth/session` con el Bearer recibido y sin `x-database-selection`; mostrar confirmación solo si coinciden el usuario y la base elegida, usando el cuerpo JSON y no el encabezado del login; verificar un flujo completo para MongoDB y otro para Supabase, incluyendo que el encabezado inicial predeterminado no produce un falso error con Supabase.
- [x] 2.3 Conservar el token solo en memoria, borrar la contraseña al confirmar y agregar “Volver al inicio de sesión” para descartar el token local; verificar que se puede ingresar luego con la otra base, que no hay credenciales ni tokens en almacenamiento, cookies o URL y que recargar devuelve campos vacíos y MongoDB seleccionado.
- [x] 2.4 Implementar errores accesibles, un límite de 15 segundos por solicitud, limpieza del token fallido y recuperación del formulario conservando usuario y selección; verificar con respuestas simuladas los errores HTTP, JSON inválido, token ausente/rechazado, usuario o base inconsistentes, fallo de red y timeout, comprobando que nunca se muestra éxito y que se permite reintentar.
- [x] 2.5 Agregar `test/login.session.test.js` con verificaciones HTTP de login/sesión para ambos destinos, usando `src/app.js` sin conexiones a bases ni llamadas a brokers; verificar con `node --test test/login.session.test.js` los cuerpos existentes, el contexto del JWT sin encabezado, la prioridad del encabezado explícito, el destino predeterminado sin token y el rechazo de un Bearer inválido.
- [x] 2.6 Completar en `README.MD` el flujo de confirmación, el cambio de base y la pérdida de sesión al recargar; verificar que explique que el acceso no valida cuentas, no comprueba disponibilidad de la base y que volver al formulario descarta la sesión local sin revocar el JWT.

## 3. Verificación integral del cambio

- [x] 3.1 Ejecutar `node --test test/login.routes.test.js test/login.session.test.js` y confirmar que todas las pruebas focalizadas pasan, sin iniciar conexiones externas ni ejecutar los scripts de pruebas financieras.
- [x] 3.2 Recorrer en navegador los escenarios de `specs/inicio-sesion/spec.md`, incluyendo ambas bases, errores recuperables, teclado, teléfono, vuelta al formulario, nuevo login y recarga; verificar en las solicitudes que el destino seleccionado llega al login y se confirma a través del JWT.
- [x] 3.3 Revisar el diff final y comprobar que solo contiene la pantalla, su router y montaje, pruebas focalizadas, README y artefactos relacionados; verificar que permanecen intactos los contratos REST, la colección Postman, autenticación de demostración, repositorios y lógica de brokers/coberturas.
