# Tasks: Implementación de API v2, Screener Cuantitativo, TradingView y React

## 1. Configuración de Arquitectura y Enrutamiento v2

- [x] 1.1 Crear la estructura OpenSpec `openspec/changes/v2-screener-tradingview/` con propuesta, diseño, especificación y tareas.
- [x] 1.2 Configurar el enrutamiento dual en `src/app.js` para registrar formalmente `/api/v2` y conservar el soporte retrocompatible para `/api/v1`.
- [x] 1.3 Crear la estructura modular `src/api/v2/` con su índice de rutas correspondiente.

## 2. Desarrollo del Motor de Screening Cuantitativo (Backend v2)

- [x] 2.1 Implementar `src/api/v2/services/scanner.service.js` con el algoritmo de evaluación de canasta de mercado, filtrado OTM, optimización de primas y cálculo de probabilidad estocástica Black-Scholes $N(d_2)$.
- [x] 2.2 Implementar `src/api/v2/controllers/scanner.controller.js` con validación de parámetros de consulta (`limit`, `sortBy`, `dteHorizon`, `broker`).
- [x] 2.3 Conectar la ruta `GET /api/v2/market/scanner/top-collars` y verificar su respuesta HTTP local.

## 3. Pruebas Automatizadas y Regresión de Calidad

- [x] 3.1 Crear la suite `test/scanner.v2.test.js` probando escenarios válidos, límites, ordenamiento por probabilidad vs crédito neto y manejo de errores 400.
- [x] 3.2 Ejecutar la suite completa de pruebas unitarias (`npm test`) y certificar que las 61 pruebas preexistentes + las nuevas pruebas v2 pasen al 100% (cero fallos, 71 pruebas aprobadas).

## 4. Frontend React y Componentes TradingView (Cloudflare Pages)

- [x] 4.1 Inicializar la aplicación React SPA en `client/` con Vite y Tailwind CSS.
- [x] 4.2 Desarrollar la pantalla de Login con conmutación dinámica de base de datos (`mongodb` vs `supabase`) y selección de broker.
- [x] 4.3 Desarrollar el Dashboard interactivo con el botón de escaneo Top 5 / Top 10, comparador de primas y semáforo de probabilidad.
- [x] 4.4 Integrar los widgets oficiales de TradingView (`Advanced Real-Time Chart` y `Technical Analysis Widget`).
- [x] 4.5 Configurar `_redirects` y verificar el build de producción para Cloudflare Pages.

## 5. Documentación y Sincronización Postman

- [x] 5.1 Actualizar el contrato formal `spec/openspec.yaml` con las definiciones y esquemas de `/api/v2`.
- [x] 5.2 Actualizar `NOTA_MAESTRA_EVERNOTE.md` y su versión HTML agregando el protocolo exhaustivo de selección de empresas y las justificaciones del análisis técnico.
- [x] 5.3 Regenerar y sincronizar las colecciones Postman mediante `python scripts/build_full_postman_collection.py`.
- [ ] 5.4 Realizar commit y push en la rama `dev` con la autoría de `LuisonTwentyThree`.
