# inicio-sesion Specification

## Purpose

Permitir iniciar una sesión de demostración desde una pantalla web y seleccionar MongoDB o Supabase como contexto de persistencia, mostrando de forma clara el resultado de la selección.

## Requirements

### Requirement: Pantalla de acceso de demostración

El sistema SHALL ofrecer una pantalla pública en `/login` con campos etiquetados de usuario y contraseña, un selector de base de datos y una acción para iniciar sesión. El formulario inicial SHALL omitir el aviso y la insignia de demostración, conforme al diseño aceptado. El carácter de demostración del acceso, la ausencia de validación de cuentas reales y el hecho de que la selección no comprueba la disponibilidad de las bases SHALL documentarse en `README.MD`. El formulario y sus mensajes SHALL ser utilizables con teclado y en pantallas de teléfono y escritorio.

#### Scenario: Abrir el formulario
- **WHEN** una persona visita `/login` sin token
- **THEN** se muestra el formulario sin aviso ni insignia de demostración y el campo de contraseña oculta su contenido

#### Scenario: Usar el formulario en teléfono o con teclado
- **WHEN** la persona usa una pantalla de 360 píxeles de ancho o recorre los controles con el teclado
- **THEN** puede acceder a todos los campos y acciones sin desplazamiento horizontal, con etiquetas y foco visibles

### Requirement: Switch entre MongoDB y Supabase

La pantalla SHALL presentar un selector tipo switch con las opciones visibles MongoDB y Supabase y exactamente una opción activa. MongoDB SHALL ser la selección inicial al abrir la página. Cambiar la opción antes de enviar el formulario SHALL conservar las credenciales escritas y no emitir solicitudes a la API.

#### Scenario: Selección inicial
- **WHEN** se abre una nueva visita a `/login`
- **THEN** MongoDB aparece seleccionado y Supabase aparece como alternativa

#### Scenario: Cambiar de base antes de ingresar
- **WHEN** la persona selecciona Supabase con el puntero o el teclado
- **THEN** Supabase queda como única opción activa, las credenciales permanecen en el formulario y todavía no se envía una solicitud

### Requirement: Validación y envío único

La pantalla SHALL impedir el envío si el usuario está vacío o contiene solo espacios, o si la contraseña está vacía. La contraseña SHALL enviarse sin alterar su contenido. Mientras se procesa un intento, la pantalla SHALL anunciar el estado de carga, impedir envíos adicionales y mantener fija la selección de base hasta que termine el intento.

#### Scenario: Datos incompletos
- **WHEN** se intenta ingresar sin usuario válido o sin contraseña
- **THEN** se identifica el campo que requiere corrección y no se solicita una sesión

#### Scenario: Pulsaciones repetidas durante la carga
- **WHEN** ya existe un intento en curso y la persona vuelve a pulsar ingresar o intenta mover el switch
- **THEN** se mantiene el destino original y se envía como máximo una solicitud de login para ese intento

### Requirement: Login con el destino seleccionado

La pantalla SHALL consumir `POST <API_URL>/auth/login` en el mismo origen con un cuerpo JSON que contenga `username`, `password` y `databaseTarget`. El destino SHALL ser `mongodb` o `supabase` según la opción elegida. Las solicitudes SHALL respetar el prefijo de API configurado en el servidor y SHALL conservar el comportamiento de demostración existente.

#### Scenario: Ingresar con MongoDB
- **WHEN** se envían credenciales no vacías con MongoDB seleccionado
- **THEN** se solicita el login con `databaseTarget: "mongodb"` y no se exige que exista una cuenta almacenada

#### Scenario: Ingresar con Supabase
- **WHEN** se envían credenciales no vacías con Supabase seleccionado
- **THEN** se solicita el login con `databaseTarget: "supabase"` y no se exige que exista una cuenta almacenada

#### Scenario: Prefijo de API diferente
- **WHEN** el servidor utiliza un `API_URL` diferente de `/api/v1`
- **THEN** el formulario envía las solicitudes de autenticación a ese prefijo sin requerir cambios en los archivos del navegador

### Requirement: Confirmación de sesión y base seleccionada

Después de recibir un token y un `activeDatabase` coherente con la selección, la pantalla SHALL consultar `GET <API_URL>/auth/session` con `Authorization: Bearer <token>` y sin un encabezado que sobrescriba la base del token. Solo SHALL mostrar éxito cuando la consulta confirme el usuario y el mismo `activeDatabase`. La confirmación SHALL mostrar el usuario y la etiqueta de la base seleccionada sin afirmar que existe una conexión verificada con esa base.

#### Scenario: Confirmar el contexto del JWT
- **WHEN** el login y la consulta de sesión responden correctamente para la base elegida
- **THEN** se muestra la confirmación con el usuario y esa base, y la solicitud de sesión usa el token recibido

#### Scenario: Respuesta incompleta o inconsistente
- **WHEN** falta el token o el usuario esperado, o el login o la sesión informan una base diferente de la elegida
- **THEN** no se muestra una sesión exitosa, se descarta cualquier token del intento y se informa un error recuperable

### Requirement: Recuperación ante errores

La pantalla SHALL mostrar un mensaje comprensible ante errores HTTP, fallos de red, respuestas no utilizables o rechazo del token al verificar la sesión. SHALL retirar el estado de carga, permitir reintentar y conservar el usuario y la base elegidos. Un fallo SHALL dejar el intento sin token activo y SHALL permitir volver a introducir la contraseña si fue borrada.

#### Scenario: Error de red o de servidor
- **WHEN** falla la solicitud de login o de sesión
- **THEN** el formulario vuelve a estar disponible, conserva el usuario y la base elegidos y muestra un mensaje accesible sin confirmar una sesión

#### Scenario: Token rechazado
- **WHEN** la consulta de sesión responde con un error de autorización
- **THEN** se elimina el token del intento y la persona puede solicitar una nueva sesión desde el formulario

### Requirement: Sesión local temporal y cambio de base

La pantalla SHALL mantener el token únicamente en memoria durante la visita y SHALL evitar guardar credenciales o tokens en almacenamiento persistente, cookies o URL. Tras completar un intento exitoso SHALL borrar la contraseña del formulario. La confirmación SHALL permitir volver al formulario descartando el token local; cambiar de base después del acceso SHALL requerir un nuevo login y un nuevo token.

#### Scenario: Elegir otra base después de ingresar
- **WHEN** la persona vuelve al formulario desde la confirmación
- **THEN** se descarta el token local, la contraseña está vacía y se puede elegir otra base para un nuevo login

#### Scenario: Recargar la página
- **WHEN** se recarga `/login` después de una sesión exitosa
- **THEN** aparece un formulario sin token ni contraseña restaurados y MongoDB vuelve a ser la selección inicial

### Requirement: Compatibilidad con los clientes de la API

La incorporación de la pantalla SHALL conservar los contratos existentes de login y sesión, la prioridad actual de selección de base para los clientes de la API, el descriptor del servicio y las rutas de documentación. La pantalla SHALL funcionar sin agregar registro de usuarios, logout remoto ni requisitos de autenticación para los demás endpoints.

#### Scenario: Uso directo de la API
- **WHEN** un cliente existente solicita un login o consulta la sesión sin usar la pantalla
- **THEN** conserva los mismos cuerpos de solicitud, respuestas y reglas de resolución de base de datos

#### Scenario: Acceder a la documentación existente
- **WHEN** un cliente visita el descriptor de la API, su documentación o su especificación JSON
- **THEN** las rutas continúan ofreciendo sus recursos habituales y no redirigen al nuevo formulario
