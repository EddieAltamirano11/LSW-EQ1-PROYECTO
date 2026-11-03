# Design

## Context

La motivación y el alcance funcional están en `proposal.md`; los criterios observables están en `specs/inicio-sesion/spec.md`.

El repositorio contiene una API Node.js con módulos ESM y Express 4, sin frontend ni herramientas de compilación de interfaz. `src/app.js` publica el descriptor, Scalar y el enrutador de API. El prefijo se obtiene de `config.API_URL`, cuyo valor predeterminado es `/api/v1`.

`src/api/v1/services/auth.service.js` emite un JWT de 24 horas con `username`, `role` y `dbTarget`, a partir de cualquier usuario y contraseña no vacíos. No consulta usuarios ni verifica conectividad; devuelve `{ message, token, user, activeDatabase }`. `GET <API_URL>/auth/session` devuelve `{ user, activeDatabase, status }`. La decisión del usuario es conservar este modo de demostración.

`authMiddleware` acepta solicitudes sin token y verifica un Bearer cuando está presente. `databaseContextMiddleware` resuelve el destino con la prioridad encabezado válido `x-database-selection`, claim `dbTarget` y MongoDB predeterminado. En el login, su encabezado de respuesta `X-Active-Database` puede reflejar MongoDB aunque el cuerpo del login seleccione Supabase, porque el middleware se ejecuta antes de emitir el token. La pantalla debe tomar `activeDatabase` del JSON del login y luego confirmar el contexto con la consulta de sesión.

No hay capacidades existentes en `openspec/specs/`. El contrato REST publicado vive en `spec/openspec.yaml`; es un documento diferente de los artefactos OpenSpec. Se observaron discrepancias preexistentes: el contrato marca `databaseTarget` como requerido aunque el servicio tiene un valor predeterminado; la colección Postman incluye registro y logout que no están implementados; el endpoint de sesión puede declarar `AUTHENTICATED` para una petición anónima. La pantalla enviará siempre un destino y un token explícitos y comprobará el usuario devuelto, sin depender de esas discrepancias ni ampliarlas.

## Goals / Non-Goals

**Goals:**

- Agregar una interfaz pequeña servida por el mismo proceso y origen que la API, aprovechando los contratos de sesión actuales.
- Mantener alineadas la selección visual, el cuerpo del login y la sesión confirmada, incluso ante errores o intentos repetidos.
- Aislar los cambios de presentación y enrutamiento web de los servicios de autenticación y de persistencia.

**Non-Goals:**

- Convertir la sesión de demostración en un sistema de identidad, proteger el resto de la API o modificar su política de acceso anónimo.
- Abrir conexiones desde el navegador, incorporar Supabase Auth o exigir que una base esté disponible para emitir el JWT.
- Crear un dashboard, persistencia entre recargas, renovación de tokens o revocación en servidor.
- Corregir discrepancias preexistentes del contrato, regenerar documentación ajena al flujo o modificar integraciones bursátiles.

## Decisions

### 1. Interfaz HTML, CSS y JavaScript dentro del servidor existente

Crear `public/login/index.html`, `public/login/login.css` y `public/login/login.js`. Encapsular la publicación en `src/web/login.routes.js` y montar ese router desde `src/app.js`. `GET /login` entregará el HTML y `/login/assets/` publicará únicamente los recursos de esta pantalla. Resolver las rutas de archivos desde `import.meta.url`, sin depender del directorio desde el que se inicia Node.

El servidor insertará exclusivamente `config.API_URL` en un atributo de configuración del HTML, escapado para ese contexto. El cliente lo usará como prefijo de rutas del mismo origen; no recibirá secretos ni configuraciones de las bases. Se conservarán los endpoints actuales y sus respuestas.

**Alternativas:** Una SPA con React agregaría dependencias y compilación para un solo formulario. Una página en otro origen requeriría configuración de despliegue adicional. Fijar `/api/v1` en JavaScript rompería la configuración existente. Se elige la interfaz servida por Express por el tamaño del cambio y la estructura observada.

### 2. Selector de dos opciones con semántica nativa

Representar MongoDB y Supabase mediante dos radios del mismo grupo dentro de un `fieldset`, presentados visualmente como un switch segmentado con un indicador móvil. MongoDB estará marcado inicialmente. Las etiquetas permanecerán visibles, el estado no dependerá solo del color y se conservarán el foco y el uso con teclado de los controles nativos.

Usar campos de usuario y contraseña, un botón de envío y regiones de estado y error anunciables. La pantalla tendrá un formulario central adaptable a teléfono y escritorio y textos breves en español. Por decisión del usuario, el formulario inicial omite el aviso y la insignia de demostración. `README.MD` explica que el acceso sigue siendo de demostración, que no valida cuentas reales y que no comprueba la disponibilidad de las bases; la confirmación de sesión conserva su referencia al modo de demostración.

El formulario inicial cabe en los tamaños de teléfono y escritorio verificados. Se acepta el desplazamiento vertical en móvil cuando aparecen mensajes de error, manteniendo todos los campos, mensajes y acciones accesibles y sin desplazamiento horizontal.

**Alternativas:** Un switch booleano dejaría ambiguo qué significa encendido. Dos botones sin un grupo exigirían implementar selección y accesibilidad manualmente. Los radios proporcionan exclusividad y semántica apropiadas sin dependencias.

### 3. Flujo de solicitud y confirmación

Gestionar tres estados de interfaz: formulario disponible, intento en curso y sesión confirmada.

1. Validar el usuario tras quitar espacios de los extremos y verificar que la contraseña no esté vacía, sin modificar la contraseña.
2. Capturar el destino del intento, deshabilitar el formulario y emitir `POST <API_URL>/auth/login` con los tres campos del contrato. No adjuntar un token de una sesión anterior.
3. Comprobar éxito HTTP, JSON utilizable, token no vacío, usuario esperado y `activeDatabase` igual al destino capturado. No interpretar `X-Active-Database` del login como resultado de esa selección.
4. Consultar `GET <API_URL>/auth/session` con el Bearer recibido, sin `x-database-selection`, para que el JWT determine el destino.
5. Comprobar el usuario, el estado y la base devueltos. Solo entonces mostrar la confirmación con los datos de la respuesta y borrar la contraseña.
6. Ante errores HTTP, de red, tiempo de espera o respuestas incompletas/inconsistentes, descartar el token, mostrar un mensaje comprensible y habilitar un nuevo intento conservando usuario y selección. Aplicar un límite de 15 segundos por solicitud para evitar un formulario bloqueado indefinidamente.

Renderizar el usuario y los mensajes como texto, sin insertar HTML procedente de respuestas. La confirmación hablará de “Base seleccionada”, ya que un JWT válido no prueba conectividad con MongoDB o Supabase.

**Alternativas:** Considerar exitoso el login sin consultar sesión no demostraría que el contexto llega a los endpoints posteriores. Enviar siempre `x-database-selection` ocultaría errores del claim `dbTarget`. Se verifica la sesión sin sobrescribir el contexto para cubrir el objetivo del switch.

### 4. Sesión temporal de la pantalla

Mantener el JWT en una variable del módulo del navegador; no usar localStorage, sessionStorage, cookies ni parámetros de URL. La confirmación sustituirá al formulario en la misma página y mostrará una acción “Volver al inicio de sesión”. Esa acción borrará el token y la contraseña y conservará usuario y selección para facilitar otro intento. Recargar iniciará una visita nueva con MongoDB seleccionado y campos vacíos.

Volver al formulario es un descarte local; no revoca el JWT emitido ni exige agregar `/auth/logout`. No se redirigirá a Scalar ni se trasladará el token a otro producto, pues no hay un destino de aplicación definido en el proyecto.

**Alternativas:** Guardar el token entre visitas ampliaría la gestión de sesión y los riesgos de exposición para una demostración. Una cookie requeriría cambiar el contrato Bearer actual. El estado en memoria cubre la confirmación solicitada con un alcance acotado.

### 5. Verificación focalizada sin operaciones financieras

Usar `node --test`, ya configurado en `package.json`, para comprobar la entrega de la página y sus recursos, el prefijo configurado y el flujo HTTP de login/sesión para ambos destinos. Importar `src/app.js` en las pruebas, sin ejecutar `src/index.js`, para no iniciar las conexiones de arranque. Verificar también la prioridad de encabezado sobre JWT y el valor predeterminado como controles de compatibilidad, y el acceso al descriptor y documentación.

En navegador, revisar ambos recorridos completos y simular respuestas erróneas/inconsistentes, fallo de red y solicitud lenta; comprobar que no hay doble envío, que el switch no emite solicitudes por sí solo y que funciona con teclado a 360 píxeles y en escritorio. No agregar una dependencia de pruebas de navegador solo para este formulario si la revisión puede hacerse con las herramientas disponibles.

**Alternativas:** `scripts/test_comprehensive_apis.mjs` realiza altas, modificaciones y eliminaciones de datos y llama brokers; no es proporcional a esta pantalla. Las verificaciones del flujo de sesión no requieren acceso a bases ni cuentas reales.

## Risks / Trade-offs

- [El modo actual acepta cualquier credencial no vacía] → Documentar el alcance de demostración en `README.MD` y conservar su referencia en la confirmación de sesión. El aviso y la insignia del formulario inicial se omiten por decisión del usuario; el acceso sigue sin verificar cuentas reales ni disponibilidad de las bases.
- [Una base puede estar caída aunque el login funcione] → Mostrar la base seleccionada sin prometer conexión verificada; conservar sin cambios las conexiones que administra el servidor.
- [El encabezado del login y su JSON pueden indicar bases diferentes] → Usar el cuerpo del login y verificar el claim mediante `/auth/session`, sin cambiar la lógica global de encabezados.
- [Una respuesta tardía o malformada puede dejar un estado engañoso] → Un solo intento activo, controles deshabilitados, timeout y confirmación basada en respuestas coherentes; eliminar cualquier token de un intento fallido.
- [El token se pierde al recargar y no se revoca al volver al formulario] → Documentar que la sesión de la pantalla es temporal y que el descarte es local, consistente con el alcance de demostración.
- [Exponer configuración o texto sin escape desde el HTML] → Incluir solo el prefijo público de API con escape de atributo y renderizar los valores de usuario como texto.

## Migration Plan

No se requieren migraciones ni nuevas variables de entorno. La implementación agregará el router web y los recursos, actualizará el README y ejecutará las verificaciones focalizadas antes de usar el inicio habitual con `npm run dev` o `npm start`. El retiro del router web y de sus recursos revierte la incorporación sin alterar usuarios, datos ni contratos REST.
