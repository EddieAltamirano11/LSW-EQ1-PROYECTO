# MAPA VISUAL DE IMPORTS Y DEPENDENCIAS
## Quién llama a quién en la API de Coberturas — Guía de estudio

**Proyecto:** LSW-EQ1-PROYECTO — Equipo 1 Los Eddies
**Objetivo:** que puedas estudiar el código siguiendo el flujo real, sin abrir 30 archivos a ciegas.
**Raíz:** `C:\Github\PERSONAL\LSW-EQ1-PROYECTO\`

---

# 0. Cómo leer este documento

Tres niveles:

1. **Diagramas** (capítulos 1–3, 5–8): la forma general del sistema.
2. **Tablas** (capítulos 4, 9): el detalle archivo → archivo.
3. **Advertencias** (capítulo 11): lo que puede hacerte fallar en la demo o en preguntas.

Regla de oro para estudiar: **sigue una petición**, no un archivo. El capítulo 5 te da tres trazas completas.

---

# 1. Bootstrap: cómo nace el proceso

```
src/index.js
│
├── import app                    → src/app.js
├── import config                 → src/config/config.js
├── import connectMongoDB         → src/config/mongo.config.js
└── import testSupabaseConnection → src/config/supabase.config.js
        │
        ├── 1. connectMongoDB()          (si falla: warning, el server sigue)
        ├── 2. testSupabaseConnection()  (si falla: warning, el server sigue)
        └── 3. app.listen(PORT=3050)
```

```
src/app.js
│
├── express, morgan, cors, yamljs, path, fs, url
├── @scalar/express-api-reference
├── config
├── routerAPI            → src/api/v1/routes/index.js
├── routerAPIv2          → src/api/v2/routes/index.js
├── loginRoutes          → src/web/login.routes.js
├── authMiddleware       → src/middlewares/auth.middleware.js
├── databaseContextMiddleware → src/middlewares/databaseContext.middleware.js
├── brokerContextMiddleware   → src/middlewares/brokerContext.middleware.js
└── errorHandler         → src/middlewares/errorHandler.middleware.js
```

**Orden real de montaje:**

```
cors → morgan → json → urlencoded
  → loginRoutes (/login)
  → static /dashboard (si existe client/dist)
  → authMiddleware
  → databaseContextMiddleware
  → brokerContextMiddleware
  → /spec.json, /docs (Scalar)
  → / y /api/v1 (descriptores)
  → routerAPI (v1)
  → routerAPIv2 (v2)
  → errorHandler
```

---

# 2. Pipeline HTTP: el viaje de cualquier request

```
+-------------+
|   Cliente   |
+------+------+
       |
       v
+------------------------------------------------------------+
| app.js                                                     |
|  1. cors / morgan / json                                   |
|  2. authMiddleware        -> req.user (si hay Bearer)      |
|  3. databaseContext       -> req.dbTarget                  |
|  4. brokerContext         -> req.broker                    |
+------+-----------------------------------------------------+
       |
       v
+------------------------------------------------------------+
| routes/*.routes.js     -> elige controller                 |
+------+-----------------------------------------------------+
       |
       v
+------------------------------------------------------------+
| controllers/*.js       -> lee req, delega, elige status    |
+------+-----------------------------------------------------+
       |
       v
+------------------------------------------------------------+
| services/*.js          -> reglas de negocio                |
|   |-- repositories/*   -> Mongo / Supabase                 |
|   |-- broker.service   -> Webull / IBKR / Alpaca           |
|   +-- quant.service    -> Black-Scholes                    |
+------+-----------------------------------------------------+
       |
       v
+------------------------------------------------------------+
| models/*.js  |  config/supabase.config.js  |  brokers      |
+------+-----------------------------------------------------+
       |
       v
   res.json(...)
       |
       +-- si algo lanzo -> next(error) -> errorHandler.middleware.js
```

---

# 3. Grafo backend por capas

```
                         +----------------------+
                         |      src/index.js    |
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         |      src/app.js      |
                         +---+------+------+----+
                             |      |      |
          +------------------+      |      +------------------+
          |                         |                         |
          v                         v                         v
+------------------+     +------------------+     +------------------+
| v1/routes/index  |     | v2/routes/index  |     |  middlewares/*   |
+--------+---------+     +--------+---------+     +------------------+
         |                        |
         v                        +-------------> v1 routes (herencia)
+------------------+              v
| v1 routes/*.js   |     +------------------+
+--------+---------+     | scanner.routes   |
         v               +--------+---------+
+------------------+              v
| controllers/*.js |     +------------------+
+--------+---------+     | scanner.controller|
         v               +--------+---------+
+------------------+              v
| services/*.js    |<-------------+
+---+----+----+----+
    |    |    |
    |    |    +----------------------+
    |    +---------------+            |
    v                    v            v
+--------------+  +--------------+  +------------------+
| repositories |  | broker.svc   |  | quant.service    |
+------+-------+  +---+------+---+  +------------------+
       |              |      |
       v              v      v
+--------------+  +--------+ +--------+ +--------+
| models/*.js  |  | webull | | ibkr   | | alpaca |
| Mongo/Supabase| | .svc   | | .svc   | | .svc   |
+--------------+  +---+----+ +---+----+ +--------+
                      v          v
              scripts/*.py   preflight.service
```

---

# 4. Tabla de imports (quién importa a quién)

## 4.1 Núcleo de arranque

| Archivo | Importa |
|---|---|
| `src/index.js` | `app.js`, `config/config.js`, `config/mongo.config.js`, `config/supabase.config.js` |
| `src/app.js` | `express`, `morgan`, `cors`, `yamljs`, `path`, `fs`, `http`, `@scalar/express-api-reference`, `config`, `v1/routes/index.js`, `v2/routes/index.js`, `web/login.routes.js`, los 4 middlewares |
| `src/config/config.js` | `dotenv` |
| `src/config/mongo.config.js` | `mongoose`, `dns`, `config` |
| `src/config/supabase.config.js` | `@supabase/supabase-js`, `config` |
| `src/config/broker.config.js` | `axios`, `config` |
| `src/config/webull.config.js` | `axios`, `config`, `utils/webullSignature.js` |
| `src/utils/webullSignature.js` | `crypto`, `config` |

## 4.2 Middlewares

| Archivo | Importa |
|---|---|
| `middlewares/auth.middleware.js` | `jsonwebtoken`, `@hapi/boom`, `config` |
| `middlewares/databaseContext.middleware.js` | — |
| `middlewares/brokerContext.middleware.js` | `config` |
| `middlewares/errorHandler.middleware.js` | `@hapi/boom` |

## 4.3 Rutas v1 → controladores

| Ruta | Importa |
|---|---|
| `v1/routes/index.js` | `config` + los 10 routers |
| `v1/routes/auth.routes.js` | `auth.controller.js` |
| `v1/routes/underlying.routes.js` | `underlying.controller.js` |
| `v1/routes/hedging.routes.js` | `hedging.controller.js` |
| `v1/routes/strategy.routes.js` | `strategy.controller.js`, `analytics.controller.js`, `leg.routes.js` |
| `v1/routes/leg.routes.js` | `leg.controller.js` |
| `v1/routes/analytics.routes.js` | `analytics.controller.js` |
| `v1/routes/quant.routes.js` | `quant.controller.js` |
| `v1/routes/broker.routes.js` | `broker.controller.js` |
| `v1/routes/market.routes.js` | `broker.controller.js` |
| `v1/routes/docs.routes.js` | `yamljs`, `fs`, `path`, `url`, `config` |

## 4.4 Controladores → servicios

| Controlador | Importa |
|---|---|
| `auth.controller.js` | `auth.service.js` |
| `underlying.controller.js` | `underlying.service.js` |
| `hedging.controller.js` | `hedging.service.js` |
| `strategy.controller.js` | `hedging.service.js`, `broker.service.js`, `hedging.repository.js`, `boom` |
| `leg.controller.js` | `hedging.service.js`, `boom` |
| `analytics.controller.js` | `quant.service.js`, `hedging.service.js`, `boom` |
| `quant.controller.js` | `quant.service.js`, `validators/black-scholes.validator.js` |
| `broker.controller.js` | `broker.service.js` |

> **Detalle de arquitectura:** `strategy.controller.js` importa directamente `getHedgingRepo`.
> Es una fuga de la capa de servicio (el controlador no debería tocar repositorios). Anótalo como mejora.

## 4.5 Servicios → dependencias

| Servicio | Importa |
|---|---|
| `auth.service.js` | `jsonwebtoken`, `boom`, `config` |
| `underlying.service.js` | `boom`, `underlying.repository.js` |
| `hedging.service.js` | `boom`, `hedging.repository.js`, `underlying.repository.js`, `quant.service.js`, `broker.service.js`, `crypto`, `config`, `preflight.service.js` |
| `quant.service.js` | `boom` (sin dependencias internas: es puro) |
| `broker.service.js` | `boom`, `axios`, `config`, `broker.config.js`, `underlying.repository.js`, `webull.service.js`, `ibkr.service.js` |
| `webull.service.js` | `boom`, `child_process`, `path`, `url`, `config`, `webull.config.js` |
| `ibkr.service.js` | `boom`, `child_process`, `path`, `url`, `config`, `preflight.service.js` |
| `alpaca.service.js` | `axios`, `config`, `broker.config.js` |
| `preflight.service.js` | `net`, `boom`, `config`, `mongo.config.js`, `supabase.config.js` |
| `v2/scanner.service.js` | `boom`, `v1/quant.service.js`, `v1/broker.service.js`, `config` |

## 4.6 Repositorios → modelos

| Repositorio | Importa |
|---|---|
| `underlying.repository.js` | `underlying.mongo.repo.js`, `underlying.supabase.repo.js` |
| `hedging.repository.js` | `hedging.mongo.repo.js`, `hedging.supabase.repo.js` |
| `underlying.mongo.repo.js` | `models/Underlying.model.js`, `crypto` |
| `underlying.supabase.repo.js` | `config/supabase.config.js`, `crypto` |
| `hedging.mongo.repo.js` | `models/HedgingStrategy.model.js`, `crypto` |
| `hedging.supabase.repo.js` | `config/supabase.config.js`, `crypto` |

## 4.7 Modelos

| Modelo | Importa |
|---|---|
| `models/HedgingStrategy.model.js` | `mongoose` |
| `models/Underlying.model.js` | `mongoose` |

---

# 5. Trazas de peticiones

## 5.1 `POST /api/v1/hedging/:id/legs`

```
1. src/app.js
      authMiddleware → databaseContextMiddleware → brokerContextMiddleware
2. src/api/v1/routes/hedging.routes.js
      router.post('/:id/legs', HedgingController.addSingleLeg)
3. src/api/v1/controllers/hedging.controller.js
      addSingleLeg(req,res,next)
4. src/api/v1/services/hedging.service.js
      addSingleLeg(strategyId, legData, dbTarget)
      └── getHedgingRepo(dbTarget)
5. src/api/v1/repositories/hedging.repository.js
      mongoRepo | supabaseRepo
6. src/api/v1/repositories/hedging.mongo.repo.js
      addLeg() → HedgingStrategy.findOne → legs.push → save()
   ó src/api/v1/repositories/hedging.supabase.repo.js
      addLeg() → legs_config = [...actuales, nueva] → update
7. src/api/v1/models/HedgingStrategy.model.js
      legSchema valida legRole, assetType, quantity, entryPrice
```

**Archivos que debes abrir para estudiarlo (en orden):**

```
src/api/v1/routes/hedging.routes.js
src/api/v1/controllers/hedging.controller.js
src/api/v1/services/hedging.service.js
src/api/v1/repositories/hedging.repository.js
src/api/v1/repositories/hedging.mongo.repo.js
src/api/v1/repositories/hedging.supabase.repo.js
src/api/v1/models/HedgingStrategy.model.js
```

## 5.2 `POST /api/v1/hedging/auto-collar`

```
1. hedging.routes.js → HedgingController.autoCalibrateCollar
2. hedging.controller.js
      resuelve symbol, broker, executeOrders
3. hedging.service.js
      autoCalibrateAndCreateCollar()
      │
      ├── preflight.service.js (BD + túnel IBKR)
      ├── broker.service.js (quote + options chain)
      │     └── webull.service.js | ibkr.service.js | alpaca.service.js
      ├── quant.service.js (Black-Scholes put/call)
      ├── broker.service.js (createBrokerOrder × 3)
      │     └── webull.service.js → scripts/webull_desktop_bridge.py
      ├── broker.service.js (getBrokerOrders para verificar)
      └── createCollarSpread()
            └── getHedgingRepo → repo.create
4. models/HedgingStrategy.model.js
```

**Archivos clave:**

```
src/api/v1/controllers/hedging.controller.js
src/api/v1/services/hedging.service.js        ← aquí vive todo el algoritmo
src/api/v1/services/quant.service.js
src/api/v1/services/broker.service.js
src/api/v1/services/webull.service.js
src/api/v1/services/preflight.service.js
src/utils/webullSignature.js
scripts/webull_desktop_bridge.py
```

## 5.3 `GET /api/v2/market/scanner/top-collars`

```
1. src/api/v2/routes/index.js
      router.use('/market/scanner', scannerRoutes)
2. src/api/v2/routes/scanner.routes.js
      router.get('/top-collars', ScannerController.getTopCollars)
3. src/api/v2/controllers/scanner.controller.js
4. src/api/v2/services/scanner.service.js
      ├── v1/quant.service.js (Black-Scholes + N(d2))
      └── v1/broker.service.js (getBrokerQuote)
```

---

# 6. v1 vs v2: qué se monta dónde

```
src/api/v1/routes/index.js
├── /api/v1/auth
├── /api/v1/underlyings
├── /api/v1/hedging
├── /api/v1/hedging-strategies   (alias de hedging)
├── /api/v1/strategies
├── /api/v1/analytics
├── /api/v1/quant
├── /api/v1/broker
├── /api/v1/market
├── /api/v1/docs
└── /api/v1/health

src/api/v2/routes/index.js
├── /api/v2/auth              → reutiliza v1
├── /api/v2/underlyings       → reutiliza v1
├── /api/v2/hedging           → reutiliza v1
├── /api/v2/hedging-strategies→ reutiliza v1
├── /api/v2/strategies        → reutiliza v1
├── /api/v2/analytics         → reutiliza v1
├── /api/v2/quant             → reutiliza v1
├── /api/v2/broker            → reutiliza v1
├── /api/v2/market            → reutiliza v1
├── /api/v2/market/scanner    → scanner.routes (nuevo)
├── /api/v2/scanner           → scanner.routes (alias)
├── /api/v2/health            → propio
└── /api/v2                   → descriptor
```

**Idea clave:** v2 no reimplementa; **hereda** los routers de v1 y agrega scanner + health.

---

# 7. Persistencia: quién elige Mongo o Supabase

```
controller
   │  pasa req.dbTarget
   ▼
service
   │  getHedgingRepo(dbTarget)  /  getUnderlyingRepo(dbTarget)
   ▼
repository selector
   │
   ├── dbTarget === 'supabase' → HedgingSupabaseRepository
   └── cualquier otro          → HedgingMongoRepository
             │
             ├── Mongo: models/HedgingStrategy.model.js (subdocumentos)
             └── Supabase: config/supabase.config.js (JSONB)
```

**Archivos de estudio:**

```
src/middlewares/databaseContext.middleware.js
src/api/v1/repositories/hedging.repository.js
src/api/v1/repositories/hedging.mongo.repo.js
src/api/v1/repositories/hedging.supabase.repo.js
src/api/v1/models/HedgingStrategy.model.js
```

---

# 8. Frontend: grafo de componentes

```
client/src/main.jsx
└── App.jsx
    ├── LoginView.jsx
    │     └── sessionTargets.js
    └── Dashboard.jsx
          ├── TradingViewWidget.jsx
          ├── CriteriaModal.jsx
          ├── BrokerExecutionModal.jsx
          ├── services/localScanner.js
          └── sessionTargets.js
```

**Flujo de datos del frontend:**

```
LoginView
  POST /api/v1/auth/login (fallback v2)
  → sesión { token, user, databaseTarget, brokerTarget, backendUrl }
  → App.jsx (estado + localStorage)
  → Dashboard.jsx
       ├── GET /api/v2/market/scanner/top-collars
       │     headers: Authorization + x-database-selection
       ├── selecciona candidato
       └── POST /api/v2/hedging/auto-collar (fallback v1)
             headers: Authorization + x-database-selection + x-broker-selection
             body: { symbol, sharesCount, portfolioId, expirationDate,
                     broker, executeOrders, autoPersist }
             → BrokerExecutionModal (3 patas + órdenes + JSON crudo)
```

**Archivos de estudio:**

```
client/src/App.jsx
client/src/components/LoginView.jsx
client/src/components/Dashboard.jsx
client/src/components/BrokerExecutionModal.jsx
client/src/services/localScanner.js
client/src/sessionTargets.js
```

---

# 9. Mapa endpoint → archivos

## 9.1 Tu vertical slice (Tadeo)

| Endpoint | Ruta | Controlador | Servicio | Repositorio |
|---|---|---|---|---|
| `GET /hedging/:id/legs` | `hedging.routes.js` | `hedging.controller.js` | `hedging.service.js` | `hedging.*.repo.js` |
| `GET /hedging/:id/legs/:legId` | idem | idem | idem | idem |
| `POST /hedging/:id/legs` | idem | idem | idem | idem |
| `POST /hedging/:id/legs/batch` | idem | idem | idem | idem |
| `PUT /hedging/:id/legs/:legId` | idem | idem | idem | idem |
| `DELETE /hedging/:id/legs/:legId` | idem | idem | idem | idem |
| `PUT /hedging/:id/status` | idem | idem | idem | idem |
| `DELETE /hedging/:id` | idem | idem | idem | idem |
| `GET /hedging/:id/financial-metrics` | idem | idem | idem | idem |
| `PUT /hedging/:id/financial-metrics/recalculate` | idem | idem | idem | idem |
| `GET /hedging/:id/payoff-matrix` | idem | idem | idem | idem |
| `GET /strategies/:id/legs` | `leg.routes.js` | `leg.controller.js` | `hedging.service.js` | idem |

## 9.2 Resto del sistema

| Módulo | Endpoints | Ruta | Controlador | Servicio |
|---|---|---|---|---|
| Auth | `/auth/login`, `/auth/session` | `auth.routes.js` | `auth.controller.js` | `auth.service.js` |
| Subyacentes | `/underlyings...` | `underlying.routes.js` | `underlying.controller.js` | `underlying.service.js` |
| Quant | `/quant/black-scholes`, `/quant/implied-volatility` | `quant.routes.js` | `quant.controller.js` | `quant.service.js` |
| Analítica | `/analytics/...`, `/strategies/:id/calculate-greeks` | `analytics.routes.js`, `strategy.routes.js` | `analytics.controller.js` | `quant.service.js` + `hedging.service.js` |
| Broker | `/broker/...` | `broker.routes.js` | `broker.controller.js` | `broker.service.js` |
| Scanner | `/v2/market/scanner/...` | `v2/routes/scanner.routes.js` | `v2/controllers/scanner.controller.js` | `v2/services/scanner.service.js` |
| Docs | `/docs`, `/spec.json` | `docs.routes.js` + `app.js` | — | — |

---

# 10. Ruta de estudio con checkpoints

## Día 1 — Entender la forma (2 h)

1. `src/index.js` → ¿cómo arranca?
2. `src/app.js` → orden de middlewares.
3. `src/middlewares/*.js` → `req.user`, `req.dbTarget`, `req.broker`.
4. `src/api/v1/routes/index.js` y `v2/routes/index.js` → mapa de URLs.

**Checkpoint:** dibuja de memoria el pipeline HTTP y la precedencia de `dbTarget` y `broker`.

## Día 2 — Tu módulo (3 h)

1. `routes/hedging.routes.js` (bloque legs/metrics/payoff).
2. `controllers/hedging.controller.js` (sección subdocumentos).
3. `services/hedging.service.js` (getLegsList → generatePayoffMatrix).
4. `repositories/hedging.mongo.repo.js` y `.supabase.repo.js`.
5. `models/HedgingStrategy.model.js`.

**Checkpoint:** explica sin mirar el flujo `POST /legs` y la diferencia Mongo/JSONB.

## Día 3 — El core cuantitativo (3 h)

1. `services/quant.service.js` completo.
2. `services/hedging.service.js` líneas 383–950 (auto-collar + verificación).
3. `services/broker.service.js` + `webull.service.js` + `utils/webullSignature.js`.
4. `services/preflight.service.js`.

**Checkpoint:** explica `score`, el guardrail de precio justo y el guardián CERO SIMULACIÓN.

## Día 4 — Frontend y contrato (2 h)

1. `client/src/App.jsx` → `LoginView` → `Dashboard` → `BrokerExecutionModal`.
2. `spec/openspec.yaml` (secciones de tus endpoints).
3. `test/api.contract-functional.test.js`.
4. `docs/TADEO_CORE.postman_collection.json`.

**Checkpoint:** corre la colección Postman y muestra `strategy.legs` en el JSON del modal.

---

# 11. Otras cosas que debes tomar en cuenta

## 🔴 Críticas para la demo

### 11.1 El auto-collar ejecuta órdenes reales por defecto

En `hedging.controller.js`:

```js
const executeOrdersRaw = req.body?.executeOrders ?? req.query?.executeOrders
                      ?? req.body?.executeOnBroker ?? true;
```

Y en `hedging.service.js`:

```js
executeOrders = true,
autoPersist = true,
```

**Consecuencia:** si llamas `POST /hedging/auto-collar` sin `executeOrders`, el sistema **intenta comprar/vender en el broker real** y persistir. Para simular, debes enviar explícitamente:

```json
{ "executeOrders": false }
```

No digas en la exposición "por defecto no ejecuta". Es falso. Di: "el modo seguro se activa con `executeOrders:false`".

### 11.2 El Dashboard arranca en modo real

`Dashboard.jsx`:

```js
const [liveExecutionMode, setLiveExecutionMode] = useState(true);
```

El botón de ejecución nace en **órdenes reales**. Si vas a hacer demo, cambia el toggle a simulación **antes** de hacer clic.

### 11.3 La BD del frontend y la de Postman deben coincidir

- El login manda `x-database-target`.
- El Dashboard reenvía `x-database-selection` en cada llamada.
- Postman debe usar el mismo valor y un ID válido para esa BD.

Si el frontend creó en Mongo y Postman consulta Supabase, verás `404` y parecerá que tu módulo falla.

### 11.4 Supabase exige UUID

`hedging.supabase.repo.js` valida:

```js
/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
```

Un ID `STRAT-COLLAR-NVDA-a1b2` funciona en Mongo, **no** en Supabase.

## 🟠 Datos que debes saber

### 11.5 La autenticación es opcional

`auth.middleware.js` deja pasar si no hay header `Authorization`. Solo devuelve 401 si el token existe y es inválido.
No existe `POST /auth/logout`.

### 11.6 El token se guarda en localStorage

`App.jsx` persiste `hedging_quant_session` (incluye token). La guía dice "solo en memoria"; el código dice otra cosa.
Si te preguntan, reconócelo como mejora de endurecimiento.

### 11.7 `recalculate` no reprecía

`recalculateMetrics` acepta `currentSpotPrice`, pero la variable `spot` no se usa. Recalcula crédito, piso y delta
desde las patas persistidas. Tampoco actualiza `breakevenPrice` ni `maxLossTotalUSD`.

### 11.8 `steps=25` devuelve 26 puntos

El bucle es inclusivo en ambos extremos: 25 intervalos → 26 puntos. El campo se llama `stepsCount`.

### 11.9 El batch bajo `/hedging` exige arreglo crudo

```json
[ { ... }, { ... } ]
```

No `{ "legs": [ ... ] }`. Solo `/strategies/:id/legs/batch` normaliza ambos formatos.

### 11.10 No existe `PENDING` ni `tbl_legs`

- Estados reales: `ACTIVE`, `CLOSED`, `EXPIRED`.
- Postgres guarda patas en `legs_config` (JSONB), no en una tabla `tbl_legs`.

### 11.11 La cadena de opciones de Webull es sintética

`getWebullOptionsChain` genera 5 strikes (90–110 % del spot) con primas calculadas y `Math.random()`.
La **orden** que se envía sí es real; el **menú de strikes** no viene del libro de opciones.

### 11.12 La firma de Webull es HMAC-SHA1

- HMAC-SHA1 para la firma.
- MD5 en mayúsculas solo para el digest del body.

La guía dice "HMAC/MD5"; la precisión es HMAC-SHA1 + MD5 del body.

## 🟡 Detalles finos

### 11.13 El scanner ignora el header de broker

`scanner.controller.js` usa `req.brokerTarget`, pero el middleware define `req.broker`. El valor queda `undefined`
y el servicio cae al broker por defecto.

### 11.14 `/preflight/readiness` está anunciado pero no existe

`app.js` lo muestra en el descriptor raíz, pero no hay router que lo implemente. El preflight real se ejecuta
dentro del auto-collar.

### 11.15 El contrato OpenAPI tiene diferencias con la implementación

- El spec declara `status: EXERCISED`; Mongoose no lo incluye.
- El payoff del spec usa `spotAtExpiry`, `stockPnL`, `optionsPnL`, `netStrategyPnL`; la implementación usa
  `simulatedSpot`, `unhedgedPL`, `hedgedPL`, `differenceUSD`.

### 11.16 Render puede tardar en despertar

El primer request tras inactividad puede tardar 30–60 s. Calienta la API con `GET /api/v2/health` antes de exponer.

### 11.17 CORS se resuelve en Cloudflare

`client/public/_redirects`:

```
/api/*  https://lsw-eq1-proyecto.onrender.com/api/:splat  200
/*      /index.html                                       200
```

El navegador llama al mismo origen; Cloudflare hace proxy.

### 11.18 Cobertura de pruebas

8 archivos en `test/`. Cubren contrato, motor F0, contexto, login y scanner.
**No** hay test automatizado del auto-collar con broker real ni del guardián CERO SIMULACIÓN. La evidencia es
Postman + ejecución en vivo.

### 11.19 Fuga de capas

`strategy.controller.js` importa `getHedgingRepo` directamente. Funciona, pero rompe el patrón
controlador → servicio → repositorio. Menciónalo como mejora si preguntan por arquitectura.

---

# 12. Comandos útiles

```bash
# Arrancar backend
npm run dev

# Arrancar tests
npm test

# Ejecutar la colección Postman (solo preparación)
npx --yes newman run docs/TADEO_CORE.postman_collection.json \
  -e docs/TADEO_CORE.postman_environment.json \
  --folder "00 · Preparación"

# Ver el árbol de src (PowerShell)
tree src /F

# Ver imports de un archivo
Select-String -Path src/api/v1/services/hedging.service.js -Pattern "^import"
```

---

# 13. Checklist final de estudio

- [ ] Puedo dibujar el pipeline `app.js → middleware → route → controller → service → repo`.
- [ ] Sé qué archivo decide Mongo vs Supabase.
- [ ] Sé qué archivo decide el broker.
- [ ] Sé qué hace `getHedgingRepo(dbTarget)`.
- [ ] Sé la diferencia entre `legs[]` embebido y `legs_config` JSONB.
- [ ] Sé explicar `score = 10·|C−P| + 2·|moneynessP − moneynessC|`.
- [ ] Sé explicar el guardián CERO SIMULACIÓN y que está en el auto-collar.
- [ ] Sé que `executeOrders` por defecto es `true`.
- [ ] Sé que `steps=25` devuelve 26 puntos.
- [ ] Sé que Supabase exige UUID.
- [ ] Sé que no existe `POST /auth/logout`.
- [ ] Probé la colección Postman y vi `strategy.legs` en el JSON del modal.

---

*Documento generado a partir del código real del repositorio al 2026-11-10.*
