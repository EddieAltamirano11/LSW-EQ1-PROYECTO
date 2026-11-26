# instalacion-pwa Specification

## Purpose

Permitir instalar el cliente web de Los Eddies y abrir su interfaz habitual desde el escritorio o la pantalla de inicio del dispositivo.

## Requirements

### Requirement: Instalación y arranque de Los Eddies

El cliente React SHALL poder instalarse desde los controles nativos de Chrome y Edge de escritorio, Chrome en Android y Safari en iPhone en versiones con soporte de aplicaciones web. La instalación SHALL identificar la aplicación como «Los Eddies», usar su icono institucional y abrir el cliente en modo independiente (`standalone`) desde el icono instalado.

#### Scenario: Instalar desde el menú de Chrome o Edge en escritorio
- **WHEN** el usuario visita por HTTPS una publicación del cliente en un navegador compatible y confirma la instalación desde el menú del navegador
- **THEN** el sistema ofrece un acceso identificado como «Los Eddies» y al abrirlo carga el cliente en una ventana independiente

#### Scenario: Instalar en Android o iPhone
- **WHEN** el usuario instala desde el menú de Chrome en Android o agrega el sitio a la pantalla de inicio desde Safari en iPhone como aplicación web
- **THEN** la pantalla de inicio muestra el icono de Los Eddies y al pulsarlo abre el cliente en modo independiente

#### Scenario: Abrir el cliente sin instalar
- **WHEN** el usuario abre la dirección web en una pestaña y omite la instalación o el navegador carece de esa opción
- **THEN** el cliente permite acceder a sus vistas en la pestaña

### Requirement: Recursos públicos de instalación en cada publicación

El documento de entrada de la SPA SHALL enlazar un manifiesto web público válido, con iconos de 192 × 192 y 512 × 512 píxeles y una URL de inicio dentro de su ámbito. La URL de inicio, el manifiesto y sus iconos SHALL resolver bajo la base de la SPA correspondiente, en `/` de Cloudflare Pages o en `/dashboard/` de Express cuando este publique el build. Las publicaciones instalables SHALL usar HTTPS, con `localhost` disponible para verificación local.

#### Scenario: Obtener el manifiesto y los iconos desde cada base
- **WHEN** el navegador hace `GET` a la URL de entrada de la SPA y obtiene las URL del manifiesto y de los iconos
- **THEN** recibe el documento React, el manifiesto JSON y los archivos de imagen correspondientes, todos con `200` y un tipo de contenido adecuado al recurso

#### Scenario: Distinguir el panel de las rutas del backend
- **WHEN** un cliente solicita `GET /`, `GET /login` o una ruta existente de `/api/v1` o `/api/v2` en Express
- **THEN** cada ruta conserva su contrato HTTP vigente, incluido el descriptor JSON de `GET /` y la pantalla pública separada de `GET /login`

### Requirement: Flujos de sesión y operaciones en la aplicación instalada

La aplicación instalada SHALL usar el control de sesión, la navegación y los destinos de API existentes. La instalación SHALL NOT agregar almacenamiento de credenciales, tokens o respuestas de la API, ni colas o reenvíos al restablecer la conexión. Las cotizaciones, saldos y órdenes SHALL depender de la API y de los proveedores vigentes.

#### Scenario: Abrir en un contexto sin sesión válida
- **WHEN** el usuario abre la aplicación instalada y el contexto de esa instalación carece de una sesión válida
- **THEN** el cliente presenta su formulario React y tras iniciar sesión permite navegar entre Dashboard y Portafolio

#### Scenario: Perder conectividad durante una consulta de mercado
- **WHEN** falla la conexión mientras se consulta un dato en vivo
- **THEN** el cliente conserva el tratamiento de error vigente sin servir una respuesta sustitutiva desde la instalación

#### Scenario: Perder conectividad durante el envío de un Auto-Collar
- **WHEN** el envío de un Auto-Collar falla por un error de red y después se restablece la conexión
- **THEN** el cliente mantiene el aviso de resultado desconocido y la reconexión no provoca un reenvío automático
