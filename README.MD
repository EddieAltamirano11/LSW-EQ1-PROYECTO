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

## Mejora de Black-Scholes con OpenSpec

La validación de `POST /api/v1/quant/black-scholes` se desarrolla mediante el cambio
OpenSpec `validar-entrada-black-scholes`. La [evidencia SDD](docs/EVIDENCIA_SDD_BLACK_SCHOLES.md)
reúne los artefactos, la comparación antes/después, la atribución del trabajo
asistido por IA y los comandos de verificación. La optimización manual se registra
por separado cuando el equipo la realice y pueda acreditarla.
