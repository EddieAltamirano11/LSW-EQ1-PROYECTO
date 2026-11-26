# API RESTful de Coberturas Financieras de Opciones (Protective Put & Collar Spread)

> **Materia:** Laboratorio de Servicios Web  
> **Institución:** Instituto Tecnológico de Tepic (TecNM IT Tepic)  
> **Equipo 1:** Los Eddies  
> **Tema 2 / Actividad 2:** Diseño e Implementación de Servicios Web RESTful con Persistencia Políglota e Integración Cuantitativa de Mercado.

---

## 👥 Integrantes del Equipo

1. **Altamirano Plantillas Eddie David** (23400498)
2. **Durán Ocampo Luis Carlos** (23400531)
3. **Díaz Rodríguez Fernando** (23400530)
4. **Espinosa Benitez Jesús** (23400536)
5. **Martínez Orozco Carlos** (23400577)
6. **Nuñez Carvajal José Tadeo** (23400585)
7. **Rendón Vázquez Karime Lizbeth** (23400608)

---

## 🏗️ Arquitectura y Tecnologías

- **Runtime:** Node.js (v20+ ESM - ECMAScript Modules)
- **Framework Web:** Express.js v4
- **Persistencia Políglota Dual:**
  - **NoSQL:** MongoDB Atlas con Mongoose ODM
  - **Relacional / JSONB:** Supabase Cloud con PostgreSQL
- **Broker Bursátil:** Alpaca Markets API (Paper Trading)
- **Documentación de API:** OpenSpec / OpenAPI 3.0.3 interactiva con Scalar
- **Manejo de Errores:** `@hapi/boom` con middleware centralizado

---

## 🚀 Instalación y Despliegue Local

1. **Clonar el repositorio:**
   ```bash
   git clone git@github.com:EddieAltamirano11/LSW-EQ1-PROYECTO.git
   cd LSW-EQ1-PROYECTO
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Variables de entorno:**
   Copiar `.env.example` a `.env` y configurar las credenciales correspondientes:
   ```bash
   cp .env.example .env
   ```

4. **Iniciar en modo desarrollo:**
   ```bash
   npm run dev
   ```

---

## 📚 Documentación Interactiva

- **Consola de Documentación Scalar:** `http://localhost:3050/api/v1/docs`
- **Especificación OpenAPI cruda:** `http://localhost:3050/api/v1/spec.json`
- **Descriptor del Servicio:** `http://localhost:3050/api/v1`

## Inicio de sesión de demostración

Con el servidor iniciado mediante `npm run dev` o `npm start`, abrir
`http://localhost:3050/login` (ajustar host y puerto si se configuraron otros).
Seleccionar **MongoDB** o **Supabase** en el switch, escribir un usuario y una
contraseña no vacíos y pulsar **Iniciar sesión**. MongoDB es la opción inicial.

Este acceso conserva el modo de demostración de la API: no valida cuentas reales
ni comprueba la disponibilidad de la base elegida. La pantalla utiliza el prefijo
`API_URL` configurado en el servidor; no requiere editar el JavaScript para cambiarlo.

Después del acceso, la pantalla confirma la sesión con el token recibido y muestra
el usuario y la **base seleccionada**. Para elegir otra base, pulsar
**Volver al inicio de sesión**, mover el switch y realizar un nuevo login.

El token permanece únicamente en memoria durante la visita. La contraseña se borra
al confirmar el acceso o al volver al formulario. Recargar la página descarta la
sesión de la pantalla y vuelve a mostrar los campos vacíos con MongoDB seleccionado.
Volver al formulario descarta el token local; no revoca el JWT emitido por la API.
Los errores permiten reintentar y cada solicitud tiene un límite de 15 segundos.

Para comprobar la pantalla y los contratos de sesión sin iniciar conexiones a bases
ni ejecutar operaciones con brokers:

```bash
node --test test/login.routes.test.js test/login.session.test.js
```

### Cambiar destinos en el panel React

Después de ingresar al cliente React, usa los selectores **Base de datos** y **Broker** que aparecen junto al control de órdenes. Cambiar el broker vuelve a escanear con los filtros actuales. La base elegida se usa para la persistencia de las próximas coberturas. El panel recuerda ambos destinos al recargar hasta que pulses **Salir**.

En la pantalla pública `/login`, usa **Volver al inicio de sesión** para elegir otra base e ingresar de nuevo.

### Ranking por cores en el cliente React

Configura `SEC_EDGAR_USER_AGENT` en el backend con el nombre y correo de contacto del equipo. El escáner usa las credenciales de Alpaca Market Data y Webull OpenAPI ya configuradas en el backend. Las cotizaciones de Webull se identifican con el retraso informado por el proveedor.

Para probar el panel localmente, inicia la API con `npm run dev` y el cliente con `npm --prefix client run dev`. Abre el cliente y elige **Local (3050)** en la configuración de acceso. En el dashboard selecciona las fuentes de análisis y pulsa **Consultar ranking por cores**. Los filtros Top y vencimiento se toman de los controles superiores. Al abrir un candidato se muestran los siete diagnósticos y la evidencia disponible.

La consulta de solo lectura usa `POST /api/v2/strategy-screener/run` con el token de la sesión. En Postman está en **Escáner por cores (API v2)** y usa las variables `baseUrlScreener` y `tokenScreener`.

## Instalar Los Eddies como aplicación web

Abre la URL HTTPS del cliente React en Cloudflare Pages o la ruta `/dashboard/` de una instancia de Express que sirva el build. El navegador también permite comprobar la instalación en `localhost`. Las consultas y las órdenes al broker requieren conexión. Si la aplicación instalada abre sin una sesión válida, inicia sesión desde su formulario habitual.

- **Chrome en escritorio.** Abre **Más → Enviar, guardar y compartir → Instalar página como aplicación** y confirma la instalación. [Ayuda de Chrome](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DDesktop&hl=es)
- **Edge en escritorio.** Abre **Configuración y más → Más herramientas → Aplicaciones → Instala este sitio como una aplicación** y confirma. [Soporte de Microsoft](https://support.microsoft.com/es-es/edge/install-manage-or-uninstall-apps-in-microsoft-edge)
- **Chrome en Android.** Abre **Más → Instalar y crear acceso directo → Instalar** y sigue las indicaciones. [Ayuda de Chrome para Android](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=es)
- **Safari en iPhone.** Abre **Compartir → Agregar a Inicio**, activa **Abrir como app web** si aparece la opción y toca **Agregar**. [Soporte de Apple](https://support.apple.com/es-mx/guide/iphone/iphea86e5236/ios)

Abre **Los Eddies** desde el icono que aparece en el dispositivo.

### Probar la instalación localmente

Desde la raíz del repositorio, compila el cliente y abre la vista previa:

```bash
npm --prefix client run build
npm --prefix client run preview
```

Abre `http://localhost:4173/` o la URL que imprima Vite. Para probar el mismo build servido por Express, abre `http://localhost:3050/dashboard/` con el servidor del proyecto en ejecución. La barra final forma parte de la URL de entrada.

Puedes comprobar que ambas entradas sirven el manifiesto como JSON:

```powershell
curl.exe -I http://localhost:4173/manifest.webmanifest
curl.exe -I http://localhost:3050/dashboard/manifest.webmanifest
```

## Mejora de Black-Scholes con OpenSpec

La validación de `POST /api/v1/quant/black-scholes` se desarrolla mediante el cambio
OpenSpec `validar-entrada-black-scholes`. La [evidencia SDD](docs/EVIDENCIA_SDD_BLACK_SCHOLES.md)
reúne los artefactos, la comparación antes/después, la atribución del trabajo
asistido por IA y los comandos de verificación. La optimización manual se registra
por separado cuando el equipo la realice y pueda acreditarla.
