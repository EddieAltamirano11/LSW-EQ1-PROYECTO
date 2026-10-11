# API RESTful de Coberturas Financieras de Opciones (Protective Put & Collar Spread)

> **Materia:** Laboratorio de Servicios Web  
> **Institución:** Instituto Tecnológico de Tepic (TecNM IT Tepic)  
> **Equipo 1:** Los Eddies  
> **Tema 2 / Actividad 2:** Diseño e Implementación de Servicios Web RESTful con Persistencia Políglota e Integración Cuantitativa de Mercado.

---

## 👥 Integrantes del Equipo

1. **Altamirano Plantillas Eddie David** (23400498)
2. **Durán Ochoa Luis Carlos** (23400508)
3. **Díaz Rodríguez Fernando** (23400506)
4. **Espinoza Barajas Jesús** (23400509)
5. **Martínez Carlos**
6. **Núñez Carrillo José Tadeo** (23400520)
7. **Rendón Valenzuela Karime** (23400525)

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