# EL CORE DEL SISTEMA — Guía completa, de la base al detalle

**Proyecto:** Infraestructura RESTful para Coberturas Financieras de Opciones (Zero-Cost Collar & Protective Put)
**Materia:** Laboratorio de Servicios Web — TecNM IT Tepic
**Equipo:** Equipo 1 — Los Eddies
**Docente:** Dr. Francisco Ibarra Carlos

> Este documento explica **el núcleo del sistema completo**: qué es lo que realmente hace funcionar la plataforma,
> cómo viaja una petición de punta a punta, dónde vive cada decisión y qué pasa cuando algo falla.
> Está basado en el **código real** del repositorio, no en la guía de exposición.
> Para el detalle de un módulo específico (legs, métricas, payoff) existe el documento
> `GUIA_DEFENSA_TADEO_LEGS_METRICS_PAYOFF.md`; este documento es el mapa del sistema entero.

---

# ÍNDICE

1. Qué significa "el core" en este proyecto
2. El sistema en una página
3. Los 6 núcleos y el contrato entre ellos
4. Mapa del repositorio
5. Arranque del sistema y ciclo de vida del proceso
6. El pipeline HTTP: middlewares, contexto y errores
7. Flujo end-to-end canónico (12 pasos)
8. Núcleo 1 — Identidad y contexto (Auth + Switch)
9. Núcleo 2 — Motor cuantitativo F0 (Black-Scholes)
10. Núcleo 3 — Estructurador F2 (Auto-Collar y derivados)
11. Núcleo 4 — Persistencia políglota (Repository)
12. Núcleo 5 — Ejecución multibroker y regla CERO SIMULACIÓN
13. Núcleo 6 — Selección y presentación (Scanner v2 + React)
14. Contratos: OpenAPI, Scalar, Postman, v1/v2
15. Despliegue: Render + Cloudflare Pages
16. Pruebas: qué está cubierto y qué no
17. Los 12 puntos de fallo y cómo responde el sistema
18. Realidad vs guía: 12 discrepancias del core
19. Cómo explicar el core en 3 minutos
20. 15 preguntas de defensa del core
21. Glosario mínimo y checklist

---

# 1. Qué significa "el core" en este proyecto

En una aplicación REST hay tres capas de valor:

1. **La superficie**: las rutas, los JSON, el frontend. Es lo que se ve.
2. **La plomería**: Express, middlewares, validaciones, errores.
3. **El core**: las decisiones que hacen que el sistema sea *este* sistema y no otro.

En este proyecto, **el core es el ciclo que convierte una idea financiera en una operación real y auditable**:

```
   idea de cobertura
        │
        ▼
   selección del activo        (Scanner v2)
        │
        ▼
   cálculo del precio justo    (Motor F0 / Black-Scholes)
        │
        ▼
   estructuración del collar   (Motor F2 / Auto-Collar)
        │
        ▼
   ejecución en el broker      (Webull / Alpaca / IBKR)
        │
        ▼
   verificación en vivo        (regla CERO SIMULACIÓN)
        │
        ▼
   persistencia dual           (MongoDB / Supabase)
        │
        ▼
   seguimiento y payoff        (legs, métricas, matriz P&L)
```

Todo lo demás (rutas, DTOs, headers, docs) existe para que ese ciclo sea **repetible, observable y defendible**.

**Frase para abrir cualquier explicación del core:**

> "El core es un pipeline transaccional: selecciono un activo con criterios cuantitativos, valúo sus opciones con
> Black-Scholes, estructuro un collar de costo cero, lo ejecuto en un broker real, verifico que el broker lo aceptó
> y solo entonces lo persisto en la base de datos. Si cualquiera de esos pasos falla, no se escribe nada."

---

# 2. El sistema en una página

## 2.1 Vista de infraestructura

```
┌──────────────────────────────────────────────────────────────────────┐
│                        USUARIO / NAVEGADOR                           │
│  React + Vite (Cloudflare Pages)  ·  Scalar Docs  ·  Postman         │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ HTTPS
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    BACKEND REST — Node.js ESM                        │
│                    Express en Render Cloud                           │
│                                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────────┐   │
│  │  Auth JWT  │  │  Switch BD │  │  Switch    │  │  Error Handler│   │
│  │  (opcional)│  │  (contexto)│  │  Broker    │  │  (Boom)       │   │
│  └────────────┘  └────────────┘  └────────────┘  └───────────────┘   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                     SERVICIOS DE NEGOCIO                       │  │
│  │  quant.service  ·  hedging.service  ·  broker.service          │  │
│  │  underlying.service  ·  scanner.service  ·  auth.service       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────┐   ┌──────────────────────────────────┐ │
│  │  REPOSITORIOS (interfaz) │   │  BRIDGES / CLIENTES DE BROKER    │ │
│  │  Mongo  |  Supabase      │   │  Webull (Python) · Alpaca · IBKR │ │
│  └──────────────────────────┘   └──────────────────────────────────┘ │
└───────────┬───────────────────────────────┬──────────────────────────┘
            │                               │
            ▼                               ▼
┌───────────────────────┐        ┌─────────────────────────────────────┐
│  MongoDB Atlas        │        │  Brokers bursátiles                 │
│  underlyings          │        │  Webull OpenAPI (cuenta real)       │
│  hedging_strategies   │        │  Alpaca (paper/live)                │
└───────────────────────┘        │  IBKR TWS (socket 7497)             │
            │                    └─────────────────────────────────────┘
            ▼
┌───────────────────────┐
│  Supabase PostgreSQL  │
│  tbl_underlyings      │
│  tbl_hedging_strategies│
└───────────────────────┘
```

## 2.2 Vista lógica (lo que importa para defender)

| Pregunta | Respuesta corta |
|---|---|
| ¿Qué expone? | API REST v1 y v2, OpenAPI 3.x, Scalar y colección Postman |
| ¿Cómo autentica? | JWT con claim `dbTarget`; middleware opcional que inyecta `req.user` |
| ¿Cómo elige la BD? | Header `x-database-selection` > claim JWT > query > body > `mongodb` |
| ¿Cómo elige el broker? | Header `x-broker-selection` > query `broker` > body > `DEFAULT_BROKER` |
| ¿Cómo calcula? | Black-Scholes + griegas + Newton-Raphson, en `quant.service.js` |
| ¿Cómo estructura? | Búsqueda del par put/call que minimiza `|C − P|` + penalización de simetría |
| ¿Cómo ejecuta? | Webull (bridge Python + HMAC), Alpaca (REST), IBKR (bridge Python + socket) |
| ¿Cómo persiste? | Patrón Repository sobre Mongoose o Supabase, con DTO de paridad |
| ¿Cuándo escribe en BD? | **Solo** si el broker confirmó órdenes en vivo (auto-collar) |
| ¿Dónde se despliega? | Render (backend) + Cloudflare Pages (frontend) |

---

# 3. Los 6 núcleos y el contrato entre ellos

| Núcleo | Archivo(s) clave | Pregunta que responde | Salida |
|---|---|---|---|
| **N1 Identidad y contexto** | `auth.service.js`, `auth.middleware.js`, `databaseContext.middleware.js`, `brokerContext.middleware.js` | ¿Quién eres, en qué BD y con qué broker? | `req.user`, `req.dbTarget`, `req.broker` |
| **N2 Motor F0** | `quant.service.js` | ¿Cuánto vale una opción y cómo se mueve? | precio, d1/d2, 5 griegas, IV |
| **N3 Estructurador F2** | `hedging.service.js` | ¿Qué par put/call arma el collar de costo cero? | strikes, primas, métricas, plan de órdenes |
| **N4 Persistencia** | `*.repository.js`, `*.mongo.repo.js`, `*.supabase.repo.js` | ¿Dónde y cómo se guarda con paridad? | documento/fila normalizada |
| **N5 Ejecución** | `broker.service.js`, `webull.service.js`, `ibkr.service.js`, `alpaca.service.js`, `preflight.service.js` | ¿Se ejecutó de verdad en el mercado? | `orderId`, estado, verificación |
| **N6 Selección y presentación** | `scanner.service.js`, `Dashboard.jsx`, `LoginView.jsx`, `BrokerExecutionModal.jsx` | ¿Qué activo elegir y cómo mostrarlo? | ranking, UI, evidencia visual |

## 3.1 El contrato entre núcleos (flujo de datos)

```
N1  →  req.dbTarget, req.broker, req.user
N6  →  candidato (símbolo, spot, strikes, primas, probabilidades)
N2  →  precio teórico, griegas, IV
N3  →  plan de collar + métricas + llamadas de ejecución
N5  →  órdenes reales + verificación en vivo
N4  →  persistencia del resultado verificado
N6  ←  JSON final para el modal y la gráfica
```

**Regla de oro del core:** los núcleos no se saltan. N3 **no** debe persistir antes de N5; N5 **no** debe
inventar IDs; N4 **no** debe normalizar distinto según el motor.

---

# 4. Mapa del repositorio

```
LSW-EQ1-PROYECTO/
├── src/
│   ├── index.js                      ← arranque: conecta BD y levanta Express
│   ├── app.js                        ← composición de middlewares y routers
│   ├── config/
│   │   ├── config.js                 ← variables de entorno y defaults
│   │   ├── mongo.config.js           ← conexión Mongoose
│   │   ├── supabase.config.js        ← cliente Supabase
│   │   ├── broker.config.js          ← Alpaca
│   │   └── webull.config.js          ← Webull
│   ├── middlewares/
│   │   ├── auth.middleware.js        ← JWT opcional
│   │   ├── databaseContext.middleware.js
│   │   ├── brokerContext.middleware.js
│   │   └── errorHandler.middleware.js
│   ├── utils/
│   │   └── webullSignature.js        ← HMAC-SHA1 + MD5
│   ├── web/
│   │   └── login.routes.js           ← login HTML de demostración
│   └── api/
│       ├── v1/
│       │   ├── routes/               ← auth, underlyings, hedging, strategies,
│       │   │                            analytics, quant, broker, market, docs, leg
│       │   ├── controllers/          ← adaptan HTTP ↔ servicio
│       │   ├── services/             ← NÚCLEO de negocio
│       │   ├── repositories/         ← N4: Mongo / Supabase / selector
│       │   ├── models/               ← Mongoose
│       │   └── validators/           ← validación Black-Scholes
│       └── v2/
│           ├── routes/               ← scanner + herencia de v1 + health
│           ├── controllers/
│           └── services/             ← scanner cuantitativo
├── client/
│   ├── src/
│   │   ├── App.jsx                   ← sesión
│   │   ├── components/
│   │   │   ├── LoginView.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── BrokerExecutionModal.jsx
│   │   │   ├── TradingViewWidget.jsx
│   │   │   └── CriteriaModal.jsx
│   │   └── services/localScanner.js
│   └── public/_redirects             ← proxy Cloudflare → Render
├── scripts/
│   ├── webull_desktop_bridge.py      ← puente Webull
│   ├── ibkr_desktop_bridge.py        ← puente IBKR
│   └── build_full_postman_collection.py
├── spec/openspec.yaml                ← contrato OpenAPI
├── test/                             ← 8 archivos de prueba
└── package.json                      ← ESM, scripts dev/start/test
```

**Lo que debes saber ubicar sin buscar:**

- Si te preguntan "¿dónde está la lógica?" → `src/api/v1/services/`.
- "¿Dónde se decide Mongo o Supabase?" → `repositories/*.repository.js` + `databaseContext.middleware.js`.
- "¿Dónde se firma Webull?" → `src/utils/webullSignature.js` y `scripts/webull_desktop_bridge.py`.
- "¿Dónde se valida que el broker aceptó?" → `hedging.service.js`, bloque de verificación en vivo (~líneas 807–898).
- "¿Dónde está el contrato?" → `spec/openspec.yaml`.

---

# 5. Arranque del sistema y ciclo de vida del proceso

## 5.1 `src/index.js`

```js
import app from './app.js';
import config from './config/config.js';
import { connectMongoDB, getMongoStatus } from './config/mongo.config.js';
import { testSupabaseConnection } from './config/supabase.config.js';

const startServer = async () => {
  // 1. Conexión asíncrona a MongoDB Atlas
  try { await connectMongoDB(); } catch (err) { console.warn(...); }

  // 2. Verificación de Supabase Cloud
  try { await testSupabaseConnection(); } catch (err) { console.warn(...); }

  // 3. Inicio del servidor HTTP Express
  const server = app.listen(app.get('port'), config.HOST, () => { ... });

  return server;
};

startServer();
```

Tres decisiones de diseño:

1. **El servidor arranca aunque una BD falle.** Mongo y Supabase se intentan conectar, pero un fallo solo
   produce un `console.warn`. La API queda viva y el preflight es quien bloquea operaciones que requieren escritura.
2. **Mongo se conecta primero** y con `serverSelectionTimeoutMS: 8000` (`mongo.config.js`), para no colgar el arranque.
3. **El puerto por defecto es 3050** (`config.PORT`), no 3000.

## 5.2 `src/config/config.js`

```js
const config = {
  HOST: process.env.HOST || 'localhost',
  PORT: Number(process.env.PORT || 3050),
  API_URL: process.env.API_URL || '/api/v1',
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'los_eddies_default_jwt_secret',

  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'fintech_hedging_db',

  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',

  DEFAULT_BROKER: (process.env.DEFAULT_BROKER || 'WEBULL').toUpperCase(),

  ALPACA_API_KEY_ID: ..., ALPACA_API_SECRET_KEY: ..., ALPACA_BASE_URL: ...,
  WEBULL_APP_KEY: ..., WEBULL_APP_SECRET: ..., WEBULL_ACCOUNT_ID: ...,
  IBKR_ACCOUNT_ID: ..., IBKR_TWS_HOST: ..., IBKR_TWS_PORT: 7497, IBKR_CLIENT_ID: 25,
};
```

**Punto de defensa:** todos los secretos entran por `.env`; el código solo define defaults de desarrollo.
El `JWT_SECRET` tiene un default inseguro a propósito para que el proyecto arranque sin configuración; en
producción se sobreescribe por variable de entorno. Si te preguntan por seguridad: "es un default de desarrollo,
no un secreto de producción".

## 5.3 Ciclo de vida de una petición

```
TCP → Express
   → cors, morgan, json parser
   → authMiddleware            (opcional: valida Bearer si existe)
   → databaseContextMiddleware (fija req.dbTarget)
   → brokerContextMiddleware   (fija req.broker)
   → router v1/v2
   → controller
   → service
   → repository / broker
   → response
   → errorHandler (solo si algo lanzó)
```

---

# 6. El pipeline HTTP: middlewares, contexto y errores

## 6.1 Orden real en `app.js`

```js
app.use(cors({ origin: '*' }));
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));

app.use(loginRoutes);                 // /login y assets (público)

app.use(authMiddleware);              // 1º identidad
app.use(databaseContextMiddleware);   // 2º persistencia
app.use(brokerContextMiddleware);     // 3º broker

// spec.json (v1 y v2), Scalar docs (v1 y v2), root y /api/v1
app.get(`${config.API_URL}/spec.json`, handleSpecJson);
app.get('/api/v2/spec.json', handleSpecJson);
app.use(`${config.API_URL}/docs`, apiReference({ ... }));
app.use('/api/v2/docs', apiReference({ ... }));

routerAPI(app);                       // v1
routerAPIv2(app);                     // v2

app.use(errorHandler);                // SIEMPRE al final
```

**Por qué el orden importa:**

- `authMiddleware` va **antes** de `databaseContextMiddleware` porque el claim `dbTarget` del JWT es una de las
  fuentes para elegir la base.
- `brokerContextMiddleware` va después porque es independiente de la BD.
- `errorHandler` va al final: Express lo reconoce por tener 4 argumentos y solo se invoca si algo hizo `next(error)`.

## 6.2 Autenticación: middleware "opcional"

`src/middlewares/auth.middleware.js`

```js
export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();                    // ← sin token: pasa como anónimo
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    next(boom.unauthorized('Token de autorización inválido o expirado.'));
  }
};
```

Consecuencias que debes conocer:

| Situación | Comportamiento |
|---|---|
| Sin header `Authorization` | Pasa; `req.user` es `undefined` |
| Header inválido (no `Bearer`) | Pasa; se trata como anónimo |
| Token válido | `req.user` = claims; pasa |
| Token inválido o expirado | **401** |

**Punto de defensa honesto:** "la autenticación es declarativa: el middleware valida si hay token, pero no bloquea
las rutas por defecto. El endurecimiento por endpoint es una mejora pendiente; hoy la protección real está en el
contrato y en el frontend."

## 6.3 Contexto de base de datos

```js
const headerSelection = (req.headers['x-database-selection'] || req.headers['x-db-target'])?.toLowerCase();
const tokenTarget = req.user?.dbTarget?.toLowerCase();
const queryTarget = (req.query?.database || req.query?.dbTarget || req.query?.db)?.toLowerCase();

let selected = 'mongodb';
if (['mongodb','supabase'].includes(headerSelection)) selected = headerSelection;
else if (['mongodb','supabase'].includes(tokenTarget)) selected = tokenTarget;
else if (['mongodb','supabase'].includes(queryTarget)) selected = queryTarget;
else if (req.body?.databaseTarget && [...].includes(...)) selected = ...;

req.dbTarget = selected;
if (req.body && typeof req.body === 'object') req.body.databaseTarget = selected;
res.setHeader('X-Active-Database', selected);
```

**Precedencia exacta:** header > claim JWT > query > body > `mongodb`.
**Observabilidad:** toda respuesta lleva `X-Active-Database`, incluso las de error (`activeDatabase`).

## 6.4 Contexto de broker

```js
const headerSelection = req.headers['x-broker-selection']?.toUpperCase();
const querySelection = req.query?.broker?.toUpperCase();
const defaultBroker = config.DEFAULT_BROKER || 'WEBULL';

let selected = defaultBroker;
if (['WEBULL','ALPACA','IBKR','SIMULATED'].includes(headerSelection)) selected = headerSelection;
else if (['WEBULL','ALPACA','IBKR','SIMULATED'].includes(querySelection)) selected = querySelection;
else if (req.body?.broker && [...].includes(String(req.body.broker).toUpperCase())) selected = ...;

req.broker = selected;
if (req.body && typeof req.body === 'object') req.body.broker = selected;
res.setHeader('X-Active-Broker', selected);
```

**Precedencia:** header > query > body > `DEFAULT_BROKER` (WEBULL).
**Normalización:** el middleware **sobrescribe** `req.body.broker` para que no haya contradicción entre header y payload.

## 6.5 Manejo centralizado de errores

```js
if (!boom.isBoom(error)) {
  if (error.statusCode || error.status) {
    error = boom.boomify(error, { statusCode: error.statusCode || error.status });
  } else if (error.name === 'ValidationError') {
    error = boom.badRequest(error.message);                 // Mongoose → 400
  } else if (error.code === 11000) {
    error = boom.conflict('Llave duplicada en la base de datos.'); // Mongo → 409
  } else {
    error = boom.badImplementation(error.message || 'Error interno del servidor.');
  }
}
res.status(output.statusCode).json({
  ...output.payload,
  timestamp: new Date().toISOString(),
  path: req.originalUrl,
  activeDatabase: req.dbTarget || 'unknown',
});
```

**Contrato de error uniforme:**

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Parámetros numéricos inválidos para Black-Scholes (S, K, T y sigma deben ser > 0).",
  "timestamp": "2026-11-10T12:00:00.000Z",
  "path": "/api/v1/quant/black-scholes",
  "activeDatabase": "mongodb"
}
```

Ese `path` + `activeDatabase` es lo que permite diagnosticar en Render sin adivinar.

---

# 7. Flujo end-to-end canónico (12 pasos)

Este es el recorrido que debes poder contar sin mirar código. Usa el auto-collar con Webull como ejemplo.

```
1.  POST /api/v1/auth/login
       body: { username, password, databaseTarget: "mongodb" }
       → JWT (24 h) con claim dbTarget
2.  GET /api/v2/market/scanner/top-collars?limit=5&sortBy=probability&dteHorizon=45
       → ranking con strikes, primas, probabilidades y métricas
3.  POST /api/v1/hedging/auto-collar
       body: { symbol:"NVDA", sharesCount:100, executeOrders:true, broker:"WEBULL" }
4.  Middlewares:
       auth → req.user
       dbContext → req.dbTarget = "mongodb"
       brokerContext → req.broker = "WEBULL"
5.  Preflight:
       checkDatabasesHealth() → Mongo/Supabase
       (si IBKR) checkIBKRTunnel()
       si algo falla → 503 y CERO escrituras
6.  Quote del broker:
       getBrokerQuote("NVDA","WEBULL") → spot, bid, ask, volatilidad
7.  Cadena de opciones:
       getBrokerOptionsChain("NVDA", expiration, "WEBULL") → puts/calls
8.  Selección:
       filtra puts OTM (K < S) y calls OTM (K > S)
       evalúa todos los pares con score = 10·|C−P| + 2·|distPut−distCall|
       elige el mínimo
9.  Valuación F0:
       Black-Scholes del put y del call elegidos
       guardrail de precio justo (ratio 0.05–8.0)
10. Ejecución:
       Webull: combo COVERED_STOCK (100 acciones + call vendida) + put comprada
       otros: 3 órdenes individuales
11. Verificación en vivo:
       GET órdenes del broker
       rechaza IDs sintéticos y estados inválidos
       si alguna pata no está confirmada → 503 y NO se persiste
12. Persistencia:
       createCollarSpread() → repo.create() en Mongo o Supabase
       respuesta con analysis + strategy + brokerExecution
```

**La regla que resume el core:** el paso 12 depende del 11, y el 11 depende del 10. No hay atajo.

---

# 8. Núcleo 1 — Identidad y contexto

## 8.1 `auth.service.js`: el JWT y el claim que gobierna la BD

```js
export const loginUser = async ({ username, password, databaseTarget = 'mongodb' }) => {
  if (!username || !password) throw boom.badRequest('Usuario y contraseña son requeridos.');

  const validTargets = ['mongodb', 'supabase'];
  const target = databaseTarget.toLowerCase();
  if (!validTargets.includes(target)) throw boom.badRequest(`databaseTarget inválido...`);

  const payload = {
    userId: `usr-${username.toLowerCase()}`,
    username,
    role: 'INVESTOR',
    dbTarget: target,
    issuedAt: new Date().toISOString(),
  };

  const token = jwt.sign(payload, config.JWT_SECRET, { expiresIn: '24h' });

  return {
    message: 'Autenticación exitosa y contexto de persistencia seleccionado.',
    token,
    user: { userId: payload.userId, username: payload.username, role: payload.role },
    activeDatabase: target,
  };
};
```

**Qué observar:**

1. **No hay tabla de usuarios.** Cualquier usuario/contraseña no vacíos genera token. El comentario del código
   lo dice explícitamente: "en un entorno de producción se consultaría una tabla de credenciales; para esta entrega
   aún no lo manejamos". Es una decisión de alcance, no un olvido.
2. **El claim `dbTarget` viaja firmado.** Eso impide que un cliente cambie la BD sin reautenticarse, salvo que use
   el header (que tiene prioridad por diseño).
3. **Expiración 24 h.** El frontend debe reautenticarse cuando recibe 401.

## 8.2 `auth.controller.js`

```js
export const login = async (req, res, next) => {
  try {
    const result = await AuthService.loginUser(req.body);
    res.status(200).json(result);
  } catch (error) { next(error); }
};

export const getSession = async (req, res, next) => {
  try {
    res.status(200).json({
      user: req.user || { role: 'ANONYMOUS' },
      activeDatabase: req.dbTarget,
      status: 'AUTHENTICATED',
    });
  } catch (error) { next(error); }
};
```

**Detalle:** `getSession` responde `200 AUTHENTICATED` incluso sin token, con `role: 'ANONYMOUS'`.
No es un bug: es una sesión de inspección. Si quieres un 401 real, debes validar `req.user` explícitamente.

## 8.3 Rutas de auth

```js
router.post('/login', AuthController.login);
router.get('/session', AuthController.getSession);
```

**No existe `POST /auth/logout`.** El cierre de sesión es del lado del cliente (borrar el estado/localStorage).
Está en la tabla de discrepancias (capítulo 18).

## 8.4 `login.routes.js`: la pantalla pública

`/login` sirve un HTML estático con CSS/JS propio. No usa React; es la pantalla institucional de demostración.
Se monta **antes** de los middlewares de contexto, por lo que es pública por definición.

---

# 9. Núcleo 2 — Motor cuantitativo F0 (Black-Scholes)

Archivo: `src/api/v1/services/quant.service.js`.

## 9.1 La normal acumulada N(x): Abramowitz-Stegun 26.2.17

```js
export const standardNormalCDF = (x) => {
  const b1 = 0.31938153;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.3989422804014327; // 1 / sqrt(2π)

  if (x >= 0.0) {
    const t = 1.0 / (1.0 + p * x);
    return 1.0 - c * Math.exp((-x * x) / 2.0)
      * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  } else {
    const t = 1.0 / (1.0 - p * x);
    return c * Math.exp((-x * x) / 2.0)
      * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  }
};
```

**Por qué se usa esto y no una tabla o una integral numérica:**

- Es una **aproximación polinómica cerrada** con error máximo ~7.5 × 10⁻⁸.
- Es determinista: los tests pueden afirmar un valor exacto a 4 decimales.
- Es rápida: se llama dos veces por opción y cientos de veces en el scanner.

La simetría `N(−x) = 1 − N(x)` está implementada con la rama negativa, lo que evita cancelación catastrófica.

## 9.2 Valuación y griegas

```js
const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
const d2 = d1 - sigma * Math.sqrt(T);

if (type === 'CALL') {
  theoreticalPrice = S * N(d1) - K * Math.exp(-r * T) * N(d2);
  delta = N(d1);
} else if (type === 'PUT') {
  theoreticalPrice = K * Math.exp(-r * T) * N(-d2) - S * N(-d1);
  delta = N(d1) - 1.0;
}

const gamma = n(d1) / (S * sigma * Math.sqrt(T));
const vega  = (S * n(d1) * Math.sqrt(T)) / 100;      // por 1 % de volatilidad
const theta = (...) / 365;                            // por día
const rho   = (...) / 100;                            // por 1 % de tasa
```

**Validaciones del método:**

```js
if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) {
  throw boom.badRequest('Parámetros numéricos inválidos para Black-Scholes (S, K, T y sigma deben ser > 0).');
}
```

La tasa `r` sí puede ser 0 o negativa (el validador HTTP lo permite), porque hay entornos de tasas negativas.

**Unidades de las griegas (pregunta típica):**

| Griega | Unidad | Ejemplo |
|---|---|---|
| Delta | cambio por $1 de spot | `-0.3726` |
| Gamma | cambio de delta por $1 | `0.018921` |
| Vega | $ por **1 %** de volatilidad | `0.3784` |
| Theta | $ por **día** | `-0.0051` |
| Rho | $ por **1 %** de tasa | `-0.4304` |

## 9.3 Ejemplo verificado (y comprobado con la suite)

Entrada: `S = 100`, `K = 100`, `T = 1`, defaults `r = 0.045`, `σ = 0.20`, `PUT`.

Salida real ejecutada contra el código:

```json
{
  "theoreticalPrice": 5.7858,
  "greeks": {
    "delta": -0.3726,
    "gamma": 0.018921,
    "theta": -0.0051,
    "vega": 0.3784,
    "rho": -0.4304
  }
}
```

Ese `5.7858` es exactamente el valor que afirma `test/api.contract-functional.test.js` línea 94.
**Puedes decir en la exposición: "el test de contrato valida este número; no es una cifra de diapositiva".**

## 9.4 Newton-Raphson para volatilidad implícita

```js
let sigma = 0.3; // semilla
for (let i = 0; i < maxIterations; i++) {
  const bs = calculateBlackScholes({ ..., volatility: sigma, ... });
  const diff = bs.theoreticalPrice - targetPrice;
  if (Math.abs(diff) < tolerance) return { impliedVolatility: sigma, iterations: i + 1, converged: true, ... };

  const rawVega = S * n(d1(sigma)) * Math.sqrt(T);   // vega SIN dividir entre 100
  if (rawVega < 1e-12) break;                        // evita división por cero
  sigma = sigma - diff / rawVega;
  if (sigma <= 0.001) sigma = 0.001;                 // límite inferior
}
return { impliedVolatility: sigma, iterations: maxIterations, converged: false, ... };
```

**Los cuatro detalles que valen puntos:**

1. **Semilla 0.3**: reduce iteraciones en opciones típicas.
2. **Vega cruda**: la griega pública está dividida entre 100; para Newton se necesita la derivada real.
3. **Guardia `1e-12`**: sin ella, una opción deep OTM produce división por cero.
4. **Clamp `0.001`**: impide volatilidades negativas.

Prueba de ida y vuelta con el código: dado `marketPrice = 2.7915`, `S = 228.50`, `K = 220`, `T = 0.0822`,
`r = 0.045`, `PUT`, el método devuelve `impliedVolatility = 0.25` en **3 iteraciones** con `converged: true`.

## 9.5 Griegas agregadas de una estrategia

```js
for (const leg of legs) {
  if (leg.assetType === 'EQUITY' || leg.legRole === 'UNDERLYING') {
    totalDelta += 1.0;
  } else {
    const type = (leg.optionType || (leg.legRole === 'HEDGE_FLOOR' ? 'PUT' : 'CALL')).toUpperCase();
    const isShort = leg.legRole === 'FINANCE_CEILING' || leg.side === 'SELL' || leg.side === 'SHORT';
    const multiplier = isShort ? -1 : 1;

    const bs = calculateBlackScholes({
      spotPrice: S,
      strikePrice: leg.strike || S,
      timeToExpirationYears: 0.1,
      volatility: 0.25,
      optionType: type,
    });

    totalDelta += bs.greeks.delta * multiplier;
    ...
  }
}
```

**Tres cosas que debes saber para no equivocarte:**

1. **Revalúa** las opciones con `T = 0.1` y `vol = 0.25` fijos, no con las griegas persistidas. Es una aproximación
   de portafolio, no un reprecio con mercado actual.
2. **El call vendido se multiplica por −1**; por eso `netDelta = 1 + Δput − Δcall`.
3. **La acción siempre vale delta 1.0**, sin importar `sharesCount` (es delta por acción).

## 9.6 Simulación F0/F2

`simulateF0F2Hedging(strategy, { futureSpotF2, daysElapsed })` devuelve:

- `unhedgedPortfolio`: P&L de la acción sola.
- `hedgedStrategy`: P&L con put y call.
- `protectionEffectivenessUSD`: cuánto ahorró la cobertura.
- `status`: `COBERTURA_ACTIVADA_PISO_PROTECTOR` / `ZONA_NEUTRAL_SANO_RENDIMIENTO` / `TECHO_ALCANZADO_GANANCIA_TOPADA`.

Es distinto del payoff matrix: aquí **sí** hay un escenario futuro con días transcurridos, no un barrido completo.

---

# 10. Núcleo 3 — Estructurador F2 (Auto-Collar y derivados)

Archivo: `src/api/v1/services/hedging.service.js`.

## 10.1 Validación del vencimiento (la regla del viernes)

```js
export const validateFutureExpirationDate = (expirationDate) => {
  // 1. Obligatoria y con formato YYYY-MM-DD
  // 2. Debe ser futura (no hoy, no pasado)
  // 3. Si no es viernes, avanza al siguiente viernes
  const dayOfWeek = expDateObj.getUTCDay();
  if (dayOfWeek !== 5) {
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    expDateObj = new Date(expDateObj.getTime() + daysUntilFriday * 86400000);
  }
  // 4. Salvaguardas de feriados: 25 dic → 18 dic; 1 ene → 31 dic del año anterior
  ...
  return `${yyyy}-${mm}-${dd}`;
};
```

**Por qué existe:** en EE. UU. las opciones estándar expiran el **viernes**. Un vencimiento en martes no existe en la
cadena real y el broker rechazaría la orden. La función normaliza la fecha **antes** de cotizar o persistir.

**Honestidad técnica:** solo cubre Navidad y Año Nuevo. No cubre Good Friday ni feriados movibles. Si te preguntan:
"el calendario completo de CBOE es una mejora; hoy están las dos fechas de cierre universal".

## 10.2 Preflight: no calcular sobre infraestructura caída

```js
export const assertBrokerAndDatabasesReadiness = async ({ dbTarget, broker }) => {
  const dbHealth = await checkDatabasesHealth();
  if (target === 'mongodb' && dbHealth.mongo !== 'CONNECTED') throw boom.serverUnavailable(...);
  if (target === 'supabase' && dbHealth.supabase !== 'CONNECTED') throw boom.serverUnavailable(...);

  if (targetBroker === 'IBKR') {
    const tunnel = await checkIBKRTunnel(2500);
    if (!tunnel.connected) throw boom.serverUnavailable(...);
  }
};
```

**Qué garantiza:** si la BD objetivo no está disponible, **no se emite ninguna orden** y **no se escribe nada**.
Es un "fail fast" de 503 con diagnóstico.

## 10.3 Obtención de mercado

```js
const quote = await getBrokerQuote(ticker, broker);
const spotPrice = quote.lastPrice;
const chain = await getBrokerOptionsChain(ticker, expirationDate, broker);
```

**Ojo con la realidad del código:** `getWebullOptionsChain` **no consulta una cadena viva**. Genera 5 strikes
alrededor del spot (90 %, 95 %, 100 %, 105 %, 110 %) con primas calculadas y un `Math.random()`. Es una cadena
sintética de referencia. La orden que se envía al broker sí es real, pero el **menú de strikes** no viene del libro
de opciones. Debes saberlo y decirlo si te preguntan por la fuente de datos (capítulo 18).

## 10.4 Selección del par: la función objetivo real

```js
for (const put of candidatePuts) {
  const putPrem = Number(put.premium || put.lastPrice || put.ask || 0);
  for (const call of candidateCalls) {
    const callPrem = Number(call.premium || call.lastPrice || call.bid || 0);
    const netPremiumDiff = Math.abs(callPrem - putPrem);
    const putDistancePct = (spotPrice - put.strike) / spotPrice;
    const callDistancePct = (call.strike - spotPrice) / spotPrice;

    const symmetryPenalty = Math.abs(putDistancePct - callDistancePct);
    const score = netPremiumDiff * 10 + symmetryPenalty * 2;

    if (score < bestScore) { bestScore = score; bestPair = { put, call, ... }; }
  }
}
```

**La ecuación real:**

```
score(P, C) = 10 · |Prima_C − Prima_P| + 2 · |Moneyness_P − Moneyness_C|
```

- El primer término busca **costo cero**.
- El segundo busca **simetría de colas** (que el piso y el techo estén a distancia similar del spot).
- El peso 10 vs 2 hace que el costo domine; la simetría desempata.

**Diferencia con la guía:** la guía dice `min |C(K_c) − P(K_p)|`. El código agrega la penalización de simetría.
Si te preguntan, di la fórmula completa: demuestra que leíste el código.

## 10.5 Guardrail de precio justo (F0)

```js
const putFairRatio = optimalPut.premium / Math.max(0.01, putBS.theoreticalPrice);
const callFairRatio = optimalCall.premium / Math.max(0.01, callBS.theoreticalPrice);
const isFairPrice = putFairRatio <= 8.0 && putFairRatio >= 0.05
                 && callFairRatio <= 8.0 && callFairRatio >= 0.05;

if (!isFairPrice) {
  throw boom.badRequest(
    `Rechazado por Filtro Cuantitativo F0 (Black-Scholes): ... No se autoriza la compra de activos ni opciones.`
  );
}
```

**Qué hace:** compara la prima de mercado contra el precio teórico. Si la desviación es mayor a 8× (o menor a 0.05×),
rechaza la operación. Es un **control de abuso de precio**, no un rechazo de mercado normal.

**Punto débil conocido:** el rango 0.05–8.0 es muy ancho; en la práctica casi nunca rechaza. Si te preguntan,
di que es un "circuit breaker" contra datos corruptos, no un filtro fino de liquidez.

## 10.6 Los tres modos de ejecución

```js
const shouldExecute = executeOrders === true || executeOrders === 'true' || params.executeOnBroker === true;
```

| `autoPersist` | `executeOrders` | Resultado |
|---|---|---|
| `false` | cualquiera | Devuelve solo `analysis`; no ejecuta ni persiste |
| `true` | `false` / omitido | Devuelve análisis; **no** ejecuta ni persiste |
| `true` | `true` | Ejecuta en broker, verifica y persiste |

**Frase de defensa:** "por defecto el sistema **no** ejecuta ni persiste; hay que pedirlo explícitamente con
`executeOrders: true`. Eso evita órdenes accidentales en una demo".

## 10.7 Ejecución Webull: combo + put

```js
if (targetBroker === 'WEBULL') {
  if (buyUnderlying !== false) {
    const comboOrder = await createBrokerOrder({
      broker: 'WEBULL', symbol: ticker,
      contractSymbol: optimalCall.contractSymbol,
      instrumentType: 'OPTION', optionType: 'CALL',
      strategy: 'COVERED_STOCK', strikePrice: optimalCall.strike,
      spotPrice, stockPrice: spotPrice,
      expirationDate: cleanExpDate,
      qty: contracts, side: 'sell', type: 'limit',
      limitPrice: optimalCall.premium, timeInForce: 'gtc',
    }, 'WEBULL');
    // 1 sola orden → 2 patas contables (stock BUY + call SELL)
  }
  // Luego: put BUY individual
}
```

**Por qué combo:** Webull exige que la venta del call esté cubierta por las 100 acciones. Si se envían por separado,
la venta del call puede rechazarse por "acciones insuficientes". El combo `COVERED_STOCK` las agrupa atómicamente.

## 10.8 Ejecución otros brokers: 3 órdenes

Para Alpaca/IBKR se emiten tres órdenes individuales: stock BUY, put BUY, call SELL. Cada una se registra en
`executedOrders` con su `orderId` y estado.

## 10.9 Verificación en vivo (el corazón de CERO SIMULACIÓN)

```js
const liveBrokerOrders = await getBrokerOrders('all', targetBroker);
const validLiveStatuses = [
  'submitted','presubmitted','pending_submit','pendingsubmit',
  'pending_new','pending','new','accepted',
  'filled','partially_filled','open','working'
];

for (const leg of executedOrders) {
  const ordId = String(leg.orderId || '');
  const foundInBroker = liveBrokerOrders.find((bo) => ...);

  // Rechazo de IDs sintéticos + exigencia de presencia real
  if (!ordId || ordId.startsWith('WB-SIM-') || ordId.startsWith('SIM-')
      || (!foundInBroker && process.env.NODE_ENV !== 'test')) {
    unverifiedOrFailedLegs.push({ ... });
    continue;
  }

  if (['cancelled','canceled','rejected','inactive','failed','expired'].includes(liveStatus)) { ... }
  else if (!validLiveStatuses.includes(liveStatus)) { ... }
  else if (foundInBroker) { leg.verifiedInBroker = true; }
}

if (unverifiedOrFailedLegs.length > 0 || executionErrors.length > 0) {
  throw boom.serverUnavailable(
    `Falla de validación en vivo con ${targetBroker}. ... ` +
    `Por política estricta ... NINGÚN dato fue insertado en la base de datos (${dbTarget.toUpperCase()}).`
  );
}
```

**Lo que este bloque garantiza:**

1. **No hay IDs inventados.** Rechaza `WB-SIM-` y `SIM-`.
2. **No hay órdenes fantasma.** La orden debe aparecer en el `GET /orders` del broker.
3. **No hay estados raros.** Solo los estados operables de la lista.
4. **No hay escritura parcial.** Si una pata falla, se aborta **todo** con 503.

**Lo que NO garantiza (honestidad):**

- No verifica que el precio de ejecución sea el límite (solo el estado).
- La rama `foundInBroker` se relaja si `NODE_ENV === 'test'`.
- El guardián está en el auto-collar; los endpoints manuales (`/protective-put`, `/collar-spread`, `/batch`)
  no pasan por esta verificación.

## 10.10 Persistencia del resultado verificado

```js
if (autoPersist) {
  const collarPayload = {
    portfolioId, broker: targetBroker, symbol: ticker, companyName,
    spotPrice, sharesCount,
    putStrike: optimalPut.strike, callStrike: optimalCall.strike,
    putPremium: optimalPut.premium, callPremium: optimalCall.premium,
    expirationDate: `${cleanExpDate}T00:00:00.000Z`,
    volatility: quote.volatility || 0.2,
    stockOrderId: stockOrder?.orderId || null,
    putOrderId: putOrder?.orderId || null,
    callOrderId: callOrder?.orderId || null,
  };
  createdStrategy = await createCollarSpread(collarPayload, dbTarget);
}
```

Los `orderId` reales se guardan **dentro de cada pata** (`leg.brokerOrderId`). Esa es la evidencia que el frontend
muestra y que el profesor puede auditar.

## 10.11 Las otras dos estructuras

### Protective Put

```js
const netDebit = premium * count;
const breakeven = S + premium;
const maxLossUSD = (S - K) * count + netDebit;
const netDelta = 1.0 + quant.greeks.delta;
```

Sin techo: la ganancia no está limitada. El piso está en `K`.

### Collar Spread manual

```js
const netCreditPerShare = p_call - p_put;
const breakeven = S - netCreditPerShare;
const maxLossUSD = (S - K_put - netCreditPerShare) * count;
const maxProfitUSD = (K_call - S + netCreditPerShare) * count;
const netDelta = 1.0 + putDelta - callDelta;
```

Es el mismo motor de métricas que usa el auto-collar, pero con strikes y primas dados por el cliente.

---

# 11. Núcleo 4 — Persistencia políglota (Repository)

## 11.1 El selector

```js
import { HedgingMongoRepository } from './hedging.mongo.repo.js';
import { HedgingSupabaseRepository } from './hedging.supabase.repo.js';

const mongoRepo = new HedgingMongoRepository();
const supabaseRepo = new HedgingSupabaseRepository();

export const getHedgingRepo = (dbTarget = 'mongodb') =>
  dbTarget === 'supabase' ? supabaseRepo : mongoRepo;
```

Misma interfaz para ambos:

```
getAll, getById, create, createBatch, update, delete
getUnderlyingSubdocument, updateUnderlyingSubdocument
getAllLegs, getLegById, addLeg, addLegsBatch, updateLeg, updateLegsBatch, deleteLeg, deleteLegsBatch
getMetrics, updateMetrics
```

## 11.2 MongoDB

Modelo: `HedgingStrategy` con `_id` String, `underlying` embebido, `legs[]` embebido, `financialMetrics` embebido.

```js
async getById(id) {
  return await HedgingStrategy.findOne({
    $or: [{ _id: id }, { portfolioId: id }],
    deletedAt: null,
  }).sort({ createdAt: -1 });
}
```

**Dos detalles:**

- Se puede buscar por `_id` **o** por `portfolioId`. Eso explica por qué Postman a veces usa un ID que parece de
  portafolio.
- `.sort({ createdAt: -1 })` hace que, si hay varios con el mismo `portfolioId`, devuelva el más reciente.

**Baja lógica:**

```js
async delete(id) {
  return await HedgingStrategy.findOneAndUpdate(
    { $or: [{ _id: id }, { portfolioId: id }], deletedAt: null },
    { $set: { deletedAt: new Date(), status: 'CLOSED' } },
    { new: true }
  );
}
```

## 11.3 Supabase / PostgreSQL

No hay tabla `tbl_legs`. La estructura real es:

| Columna | Contenido |
|---|---|
| `id` | UUID |
| `portfolio_id` | UUID o default `c0000000-...` |
| `underlying_id` | UUID de `tbl_underlyings` |
| `strategy_type` | `COLLAR`, `PROTECTIVE_PUT`, `COLLAR_SPREAD` |
| `status` | texto |
| `shares_count` | entero |
| `legs_config` | **JSONB** con el arreglo de patas |
| `financial_metrics` | **JSONB** con las métricas |
| `broker` | columna física con fallback a JSONB si no existe |

**DTO de salida** (`mapFromSupabase`): traduce snake_case a camelCase y rearma `underlying`, `legs` y
`financialMetrics` para que el JSON sea idéntico al de Mongo.

**Diferencia crítica:** `getById` en Supabase exige UUID:

```js
if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
```

Por eso un ID de negocio tipo `STRAT-COLLAR-NVDA-a1b2` **no funciona** en Supabase. En Mongo sí.

## 11.4 Por qué el embedding (y no una tabla de patas)

- Las patas son **composición**: no existen sin su estrategia.
- Lectura en una sola query, sin JOIN.
- Escritura atómica a nivel documento en Mongo.
- Baja en cascada estructural: al borrar la estrategia, las patas se van con el documento.
- En Postgres se traduce a JSONB para **preservar el contrato REST**.

**Costo:** no hay integridad referencial por pata; concurrencia last-write-wins en JSONB; no hay índice por
`strike` dentro del JSONB. Si el profesor pregunta, reconócelo y ofrece la alternativa normalizada.

## 11.5 Preflight y consistencia transaccional

`assertBrokerAndDatabasesReadiness` se ejecuta **antes** de emitir órdenes y de persistir. Si la BD objetivo no está
`CONNECTED`, lanza 503. Esto evita el escenario más peligroso: **orden ejecutada en el broker pero no registrada
en la base**.

---

# 12. Núcleo 5 — Ejecución multibroker y CERO SIMULACIÓN

## 12.1 El dispatcher

`src/api/v1/services/broker.service.js` enruta por broker:

```js
if (targetBroker === 'WEBULL') return await WebullService.getWebullAccount();
if (targetBroker === 'IBKR')   return await IBKRService.getIBKRAccount();
if (targetBroker === 'SIMULATED') return { ...in-memory... };
// Alpaca: REST con axios si está configurado
```

Operaciones cubiertas: cuenta, quote, options chain, posiciones, órdenes (GET/POST/DELETE), sync de subyacente.

## 12.2 Webull: puente Python

`webull.service.js` ejecuta un script Python con `spawnSync`:

```js
const BRIDGE_SCRIPT = path.join(__dirname, '../../../../scripts/webull_desktop_bridge.py');

const result = spawnSync(pythonCmd, [BRIDGE_SCRIPT, command, ...args], {
  encoding: 'utf-8',
  timeout: 15000,
  env: { ...process.env, WEBULL_APP_KEY, WEBULL_APP_SECRET, WEBULL_ACCOUNT_ID },
});
```

**Por qué un puente y no HTTP directo desde Node:** la firma oficial de Webull requiere un esquema específico y el
equipo ya tenía el cliente Python de la OpenAPI. El puente aísla esa complejidad y devuelve JSON por stdout.
El parser toma la **última línea** que empiece con `{`, para tolerar logs del script.

**Riesgo:** si Python no está instalado o el script falla, el servicio cae a los snapshots de respaldo. Eso permite
que la API no se caiga, pero significa que las cotizaciones pueden ser de referencia, no de mercado.

## 12.3 La firma: HMAC-SHA1 con digest MD5 del body

`src/utils/webullSignature.js`

```js
const signingHeaders = {
  'x-app-key': appKey,
  'x-signature-algorithm': 'HMAC-SHA1',
  'x-signature-version': '1.0',
  'x-signature-nonce': nonce,
  'x-timestamp': timestamp,
  'host': host,
};

const sortedKeys = Object.keys({ ...signingHeaders, ...queryParams }).sort();
const str1 = sortedKeys.map(k => `${k}=${mergedParams[k]}`).join('&');

let str2 = '';
if (body) str2 = crypto.createHash('md5').update(JSON.stringify(body)).digest('hex').toUpperCase();

const str3 = str2 ? `${path}&${str1}&${str2}` : `${path}&${str1}`;
const signature = crypto.createHmac('sha1', appSecret).update(str3).digest('base64');
```

**Aclaración importante:** la guía dice "firma HMAC/MD5". Lo correcto es:

- **HMAC-SHA1** para la firma.
- **MD5 en mayúsculas** solo para el digest del body.

Si te preguntan, di la versión precisa; demuestra que entiendes la criptografía y no solo repites la guía.

## 12.4 IBKR

`ibkr.service.js` también usa un puente Python (`ibkr_desktop_bridge.py`) contra TWS/IB Gateway por socket TCP
(puerto 7497 por defecto). El preflight hace un `net.Socket.connect` de 2.5 s antes de permitir cualquier operación.
Si el túnel no está activo, 503 y cero escrituras.

## 12.5 Alpaca

REST con `axios`:

- Cuenta: `GET /v2/account`.
- Quote: `GET /stocks/{ticker}/snapshot?feed=iex`.
- Órdenes: `GET/POST /v2/orders`.
- Posiciones: `GET /v2/positions`.

Si no hay credenciales (`isAlpacaConfigured()` falso), devuelve snapshots y una orden simulada `ALP-SIM-...`.
**Ese ID no pasará la verificación en vivo del auto-collar**, porque no existe en el broker.

## 12.6 Broker `SIMULATED`

Devuelve una cuenta y órdenes en memoria con ID `SIM-...` y estado `filled`. Es útil para pruebas de contrato,
pero **el guardián de CERO SIMULACIÓN rechaza esos IDs**. Por eso el auto-collar con `broker: "SIMULATED"` no
persiste: está diseñado para no confundir simulación con ejecución.

## 12.7 La regla CERO SIMULACIÓN, en una tabla

| Escenario | ¿Se persiste? |
|---|---|
| Auto-collar con orden real aceptada y visible en el broker | **Sí** |
| Auto-collar sin `executeOrders: true` | **No** |
| Auto-collar con `autoPersist: false` | **No** |
| Auto-collar con ID `WB-SIM-` o `SIM-` | **No** (503) |
| Auto-collar con orden rechazada/cancelada | **No** (503) |
| Auto-collar con orden no visible en el broker | **No** (503) |
| `POST /hedging/collar-spread` manual | **Sí** (no pasa por el guardián) |
| `POST /hedging/protective-put` manual | **Sí** (no pasa por el guardián) |
| `POST /broker/orders` directo | **Sí** (emite y devuelve; no persiste estrategia) |

**La frase correcta:** "la regla CERO SIMULACIÓN está implementada en el camino automático de estructuración
(auto-collar). Los endpoints manuales son herramientas de estructuración y no reclaman ejecución verificada".
No digas "todo el sistema" si no es cierto.

---

# 13. Núcleo 6 — Selección y presentación (Scanner v2 + React)

## 13.1 La canasta institucional

`MARKET_BASKET` tiene 10 activos: AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA, AMD, SPY, QQQ.
Cada uno con beta, volatilidad base, spot de referencia, RSI, SMA200 y símbolo de TradingView.

## 13.2 Vencimiento objetivo

```js
export const calculateTargetExpiration = (days = 45, refDate = new Date()) => {
  const target = new Date(refDate.getTime() + days * 86400000);
  const dayOfWeek = target.getUTCDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  let chosenDate = new Date(target.getTime() + daysUntilFriday * 86400000);

  if (month === 11 && date === 25) chosenDate = new Date(Date.UTC(year, 11, 18));
  else if (month === 0 && date === 1) chosenDate = new Date(Date.UTC(year - 1, 11, 31));

  return `${yyyy}-${mm}-${dd}`;
};
```

Misma lógica que el auto-collar, pero aquí se usa para el horizonte del scanner (30/45/60 días).

## 13.3 Spot con caché y timeout

```js
const cached = quoteCache.get(cacheKey);
if (cached && Date.now() - cached.timestamp < 60000) return cached.price;

const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Broker quote timeout')), 600));
const quote = await Promise.race([BrokerService.getBrokerQuote(symbol, broker), timeoutPromise]);
```

**Diseño:** 60 s de caché por símbolo+broker, timeout de 600 ms, y fallback transparente al spot de referencia.
Así el scanner responde rápido aunque el broker esté lento.

## 13.4 Cálculo de cada candidato

1. Strikes OTM: put ≈ 5 % debajo del spot; call ≈ 5 % arriba; redondeo a $5 si el spot > $200.
2. Black-Scholes con `T = dte/365`, `r = 0.045`, `σ = baseVolatility`.
3. Primas de mercado estimadas: put = teórico × 1.02; call = teórico × 0.98.
4. Métricas: crédito neto, crédito total, break-even, pérdida máxima, ganancia máxima, retorno máximo.
5. Probabilidades con `N(d2)`:
   - `floorProtectionPct = N(d2Put)` → probabilidad de no tocar el piso.
   - `assignmentRiskPct = N(d2Call)` → probabilidad de que te asignen el call.
   - `sweetSpotPct = N(d2Put) − N(d2Call)` → probabilidad de expirar entre piso y techo.
   - `winRatePct = N(d2Be)` → probabilidad de terminar arriba del break-even.

## 13.5 Ranking

```js
if (sortBy === 'probability') sort((a,b) => b.probabilities.floorProtectionPct - a.probabilities.floorProtectionPct);
if (sortBy === 'netCredit')   sort((a,b) => b.financialMetrics.netDebitCredit - a.financialMetrics.netDebitCredit);
if (sortBy === 'maxReturn')   sort((a,b) => b.financialMetrics.maxReturnPct - a.financialMetrics.maxReturnPct);

const ranked = evaluatedCandidates.slice(0, validLimits).map((item, idx) => ({ rank: idx + 1, ...item }));
```

Validaciones: `limit` 1–10, `dteHorizon` ∈ {30, 45, 60}, `sortBy` ∈ {probability, netCredit, maxReturn}.

## 13.6 Los 4 pilares reales (`/company-criteria`)

| Pilar | Criterio real en el código |
|---|---|
| **P01 Tendencia técnica** | Spot > SMA 200 y RSI(14) entre 45 y 65 |
| **P02 Liquidez de derivados** | Open Interest > 1,000 contratos y spread bid-ask < $0.10 |
| **P03 Volatilidad y beta** | IV entre 18 % y 45 %; beta entre 0.90 y 1.70 |
| **P04 Calendario corporativo** | Sin earnings en los próximos 15–30 días |

**La guía dice otros cuatro** (volumen > 1.5 M, opciones semanales, beta 0.8–1.8, gran capitalización).
El código es el de la tabla. Si te preguntan, cita la tabla y aclara que es el protocolo implementado.

## 13.7 TradingView

`getTradingViewConfig(symbol)` devuelve `tvSymbol` (`NASDAQ:AAPL`), configuración del chart (`interval: D`,
`theme: dark`, `studies: ['STD;SMA','STD;RSI']`) y configuración del widget de análisis técnico.
El componente React `TradingViewWidget.jsx` recrea el iframe cuando cambia el símbolo.

## 13.8 Frontend: sesión y llamadas

**Login (`LoginView.jsx`)**

- Resuelve el backend en este orden: `localStorage.hedging_backend_url` → `VITE_API_URL` → localhost:3050 → Render.
- Envía `x-database-target` y `x-broker`.
- Intenta `/api/v2/auth/login`; si 404, cae a `/api/v1/auth/login`.
- Guarda en sesión: `token`, `user`, `databaseTarget`, `brokerTarget`, `backendUrl`.

**App (`App.jsx`)**

```js
const [session, setSession] = useState(() => {
  const saved = localStorage.getItem('hedging_quant_session');
  return saved ? JSON.parse(saved) : null;
});
```

> **Discrepancia importante:** aquí el token **sí** se persiste en `localStorage`, no solo en memoria.
> La guía afirma lo contrario. Si te preguntan, di la verdad: "la sesión se persiste para no perderla al recargar;
> el endurecimiento a memoria volátil es una mejora pendiente". (Ver capítulo 18.)

**Dashboard**

- Scanner: `GET /api/v2/market/scanner/top-collars` con `Authorization: Bearer` y `x-database-target`.
- Auto-collar: intenta `/api/v2/hedging/auto-collar`; si falla, `/api/v1/hedging/auto-collar`.
- Si recibe 401, hace re-login automático y reintenta.
- Abre `BrokerExecutionModal` con la respuesta.

**Modal**

- Muestra las 3 patas (stock BUY, put BUY, call SELL).
- Tabla de órdenes con `orderId`, estado y precio límite.
- Etiqueta "Cover Option Combo" cuando detecta el combo.
- Botón para copiar el JSON completo.

---

# 14. Contratos: OpenAPI, Scalar, Postman, v1/v2

## 14.1 OpenAPI dinámico

`spec/openspec.yaml` se carga con `yamljs` en cada request a `/api/v1/spec.json` y `/api/v2/spec.json`.
No hay build: el contrato se sirve desde disco. Ventaja: se edita y se refleja al instante. Riesgo: un YAML inválido
rompe el endpoint (se captura y devuelve 500).

## 14.2 Scalar

- `GET /api/v1/docs` → referencia interactiva v1.
- `GET /api/v2/docs` → referencia interactiva v2.
- Tema `purple`, título institucional.

## 14.3 v1 y v2

v1 es la API "retrocompatible"; v2 **hereda** todos los routers de v1 y agrega:

- `/api/v2/market/scanner/*` y `/api/v2/scanner/*`.
- `/api/v2/health` con capacidades.
- `/api/v2` descriptor con endpoints principales.

**Consecuencia:** casi todo lo que existe en v1 también responde en v2. No hay duplicación de lógica, solo montaje.

## 14.4 Postman

Colección de 108 requests en 11 carpetas, generada por `scripts/build_full_postman_collection.py`.
Usa el alias `/api/v1/hedging-strategies/...` para las estrategias.

---

# 15. Despliegue: Render + Cloudflare Pages

## 15.1 Backend en Render

- Servicio web Node.js.
- Variables: `MONGODB_URI`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `JWT_SECRET`, claves de broker.
- Health check: `GET /api/v2/health` o `/api/v1/health`.
- El servidor arranca aunque una BD falle; el preflight bloquea las operaciones que la requieren.

## 15.2 Frontend en Cloudflare Pages

`client/public/_redirects`:

```
# Proxy de API hacia el microservicio en Render
/api/*  https://lsw-eq1-proyecto.onrender.com/api/:splat  200

# Regla SPA para React Router / Vite
/*      /index.html                                       200
```

**Qué resuelve:**

1. **CORS**: el navegador llama a `/api/...` en el mismo origen (Cloudflare) y el proxy reenvía a Render.
2. **SPA**: cualquier ruta desconocida sirve `index.html`, evitando 404 al recargar.

## 15.3 Build

`package.json`:

```json
"dev": "nodemon src/index.js",
"start": "node src/index.js",
"build": "npm --prefix client install && npm --prefix client run build",
"test": "node --test"
```

El backend sirve `client/dist` en `/dashboard` si existe; si no, el frontend vive en Cloudflare Pages.

---

# 16. Pruebas: qué está cubierto y qué no

Archivos en `test/`:

| Archivo | Tipo | Qué valida |
|---|---|---|
| `api.contract-functional.test.js` | Contrato | spec.json, refs internas, 400 sin stack, health, docs, Black-Scholes 5.7858, 401, contexto de BD |
| `black-scholes.validation.test.js` | Integración | Validaciones de entrada y respuestas del motor |
| `quant.unit.test.js` | Unitario | Payoff comparativo de la estrategia |
| `underlying.integration.test.js` | Integración | CRUD de subyacentes |
| `scanner.v2.test.js` | Integración | Scanner y criterios |
| `login.session.test.js` | Integración | Login/sesión |
| `login.routes.test.js` | Integración | Pantalla de login y assets |
| `context.unit.test.js` | Unitario | Middleware de contexto |

**Cobertura real del core:**

- ✅ Motor F0: precio y validaciones.
- ✅ Contrato: códigos y forma de errores.
- ✅ Contexto: header `X-Active-Database`.
- ✅ Login/sesión.
- ✅ Scanner.
- ⚠️ Auto-collar con broker real: no hay test automatizado (requiere credenciales y mercado).
- ⚠️ Verificación en vivo: no hay test unitario aislado del guardián.
- ⚠️ Paridad Mongo/Supabase: se valida por contrato, no por test cruzado de datos.

**Frase honesta:** "la suite cubre contrato, motor y contexto; la ejecución real se valida en vivo con el broker
y con la colección Postman, no con mocks".

---

# 17. Los 12 puntos de fallo y cómo responde el sistema

| # | Fallo | Detección | Respuesta |
|---|---|---|---|
| 1 | Fecha de vencimiento pasada | `validateFutureExpirationDate` | 400 explicativo |
| 2 | `S`, `K`, `T` o `σ` ≤ 0 | `calculateBlackScholes` | 400 |
| 3 | Mercado con prima absurda | guardrail de precio justo | 400 y no se ejecuta |
| 4 | No hay puts/calls OTM | filtro de cadena | 400 |
| 5 | Mongo/Supabase caídos | preflight | 503, cero escrituras |
| 6 | Túnel IBKR caído | `checkIBKRTunnel` | 503, cero escrituras |
| 7 | Broker rechaza una pata | verificación en vivo | 503, cero escrituras |
| 8 | ID sintético (`WB-SIM-`, `SIM-`) | guardián | 503 |
| 9 | Orden no visible en el broker | `foundInBroker` | 503 |
| 10 | Token inválido/expirado | `authMiddleware` | 401 |
| 11 | Payload inválido en Mongoose | `errorHandler` | 400 |
| 12 | Duplicado en Mongo (11000) | `errorHandler` | 409 |

**Patrón común:** el sistema prefiere **fallar cerrado** (no escribir) antes que registrar una verdad dudosa.

---

# 18. Realidad vs guía: 12 discrepancias del core

Esta tabla es tu blindaje. Si el profesor detecta una y tú la niegas, pierdes; si la mencionas antes, ganas.

| # | La guía dice | El código hace | Cómo responder |
|---|---|---|---|
| 1 | `POST /auth/logout` existe | **No existe**; solo `login` y `session` | "El cierre de sesión es del lado del cliente; el endpoint de logout es una mejora pendiente." |
| 2 | JWT exclusivamente en memoria (anti-XSS) | `App.jsx` guarda la sesión (con token) en **localStorage** | "La sesión se persiste para no perderla al recargar; el endurecimiento a memoria es una mejora identificada." |
| 3 | Middleware protege los endpoints | Sin token **pasa como anónimo**; solo valida si hay token | "La autenticación es declarativa; el bloqueo por endpoint es una mejora pendiente." |
| 4 | Firma Webull HMAC/MD5 | **HMAC-SHA1** + MD5 solo del body en mayúsculas | "HMAC-SHA1 para la firma; MD5 para el digest del cuerpo." |
| 5 | Scanner: volumen > 1.5 M, opciones semanales, beta 0.8–1.8, large cap | Pilares reales: tendencia SMA200/RSI, OI > 1,000 y spread < 0.10, IV 18–45 % y beta 0.90–1.70, sin earnings 15–30 d | Cita la tabla del capítulo 13.6. |
| 6 | El broker se toma de `req.broker` | El scanner usa `req.brokerTarget` (no existe) → cae al default | "El scanner ignora el header de broker por un nombre de variable; es un bug identificado." |
| 7 | `GET /api/v1/preflight/readiness` existe | Está anunciado en `/` pero **no hay ruta** | "El preflight se ejecuta dentro del auto-collar; el endpoint público está pendiente." |
| 8 | Cadena de opciones "viva" | `getWebullOptionsChain` genera 5 strikes con `Math.random()` | "La orden es real; la cadena de selección es de referencia. La integración de cadena viva es evolución." |
| 9 | CERO SIMULACIÓN en todo el sistema | El guardián está en el auto-collar; los endpoints manuales no lo aplican | "La regla se aplica al camino automático; los manuales son estructuración." |
| 10 | Estado `PENDING` en el ciclo de vida | Enum real: `ACTIVE`, `CLOSED`, `EXPIRED` | "El estado nace ACTIVE cuando el broker confirma." |
| 11 | `EXERCISED` en el contrato | El schema Mongoose no lo incluye | "El contrato declara EXERCISED; el schema operativo maneja tres estados." |
| 12 | 71/71 tests | Hay **8 archivos** de prueba con múltiples casos | "La suite tiene 8 archivos; el número 71 corresponde al conteo de casos de la guía." |

> **Regla de oro:** nunca presentes una limitación como si fuera una virtud. Preséntala como **decisión de alcance**
> y di cuál es el siguiente paso.

---

# 19. Cómo explicar el core en 3 minutos

**0:00 – 0:30 — La tesis**

> "El core es un pipeline transaccional de cobertura: selecciono, valúo, estructuro, ejecuto, verifico y persisto.
> Si el broker no confirma, no se escribe nada."

**0:30 – 1:15 — Los dos motores**

> "El motor F0 es Black-Scholes: calculo d1 y d2, uso la normal acumulada de Abramowitz-Stegun, obtengo precio y
> cinco griegas, y con Newton-Raphson saco volatilidad implícita. El motor F2 es el estructurador: filtra puts y
> calls OTM, minimiza la diferencia de primas más una penalización de simetría, y produce el collar de costo cero."

**1:15 – 1:55 — El guardián**

> "Antes de persistir, consulto las órdenes del broker. Rechazo IDs sintéticos, estados cancelados y órdenes que no
> aparezcan en el libro. Si una pata falla, aborto con 503 y cero escrituras. Eso es CERO SIMULACIÓN en el camino
> automático."

**1:55 – 2:30 — La persistencia**

> "Todo se guarda con el patrón Repository. En Mongo, patas y métricas son subdocumentos; en Postgres, JSONB en
> `legs_config` y `financial_metrics`. Un DTO normaliza la salida para que el frontend reciba el mismo JSON."

**2:30 – 3:00 — El cierre**

> "La API se documenta con OpenAPI y Scalar, se prueba con 8 archivos de test y una colección Postman, y se despliega
> en Render con frontend en Cloudflare Pages y proxy para evitar CORS. Ese es el core completo."

---

# 20. 15 preguntas de defensa del core

### 20.1 "¿Cuál es el core del sistema en una frase?"

> "Un pipeline que convierte una idea de cobertura en una operación real verificada y persistida: selección,
> valuación Black-Scholes, estructuración de costo cero, ejecución multibroker, verificación en vivo y persistencia
> dual."

### 20.2 "¿Por qué hay v1 y v2?"

> "v1 es la base retrocompatible; v2 hereda todos los routers y agrega scanner, TradingView y health con capacidades.
> No hay lógica duplicada: es el mismo servicio montado en otro prefijo."

### 20.3 "¿Cómo se decide MongoDB o Supabase?"

> "Por precedencia: header `x-database-selection` o `x-db-target`, luego el claim `dbTarget` del JWT, luego query
> `?database=`, luego body, y por defecto MongoDB. El middleware fija `req.dbTarget` y lo expone en `X-Active-Database`."

### 20.4 "¿Cómo se decide el broker?"

> "Header `x-broker-selection`, luego query `?broker=`, luego body, y por defecto `DEFAULT_BROKER` (WEBULL).
> El middleware fija `req.broker`, normaliza el body y expone `X-Active-Broker`."

### 20.5 "¿Dónde está el JWT y por qué?"

> "Se firma con `JWT_SECRET`, dura 24 h y lleva el claim `dbTarget`. En el frontend se guarda en la sesión; la guía
> dice que solo en memoria, pero el código lo persiste en localStorage. Es una mejora pendiente de endurecimiento."

### 20.6 "¿Cómo se garantiza que no hay simulación?"

> "En el auto-collar: se emiten órdenes reales, se consulta el libro del broker, se rechazan IDs `WB-SIM-`/`SIM-`
> y estados inválidos, y si una pata no está confirmada se lanza 503 sin escribir en BD. En los endpoints manuales
> no aplica ese guardián."

### 20.7 "¿Qué pasa si el broker rechaza una pata?"

> "Se acumula en `unverifiedOrFailedLegs`, se construye un mensaje con el error textual del broker y se lanza
> `boom.serverUnavailable` (503). No se ejecuta `createCollarSpread`, así que no hay escritura parcial."

### 20.8 "¿Cómo se elige el par del collar?"

> "Se filtran puts con strike menor al spot y calls con strike mayor. Se evalúan todos los pares con
> `score = 10·|primaCall − primaPut| + 2·|moneynessPut − moneynessCall|`. El mínimo gana: costo cero con simetría
> de colas."

### 20.9 "¿Qué hace el guardrail de precio justo?"

> "Compara la prima de mercado contra el precio teórico de Black-Scholes. Si el ratio sale de [0.05, 8.0], rechaza
> con 400. Es un circuit breaker contra datos corruptos o abuso de precio, no un filtro fino."

### 20.10 "¿Cómo se calcula N(d2) y para qué?"

> "Con la aproximación polinómica de Abramowitz-Stegun 26.2.17, error ~7.5e-8. En el scanner, N(d2) del put es la
> probabilidad de no tocar el piso; N(d2) del call es el riesgo de asignación; la diferencia es la probabilidad de
> expirar en el rango dulce."

### 20.11 "¿Qué pasa si Newton-Raphson no converge?"

> "Itera hasta 100 veces con tolerancia 1e-5. Si la vega cruda es menor a 1e-12, corta para evitar división por cero;
> si sigma baja de 0.001, la fija en 0.001. Devuelve `converged: false` con la última sigma, no lanza excepción."

### 20.12 "¿Cómo se mantiene la paridad Mongo/Supabase?"

> "Con el patrón Repository y un DTO. `mapFromSupabase` traduce snake_case a camelCase y rearma `legs` desde
> `legs_config`; Mongoose usa `toJSON.transform` para cambiar `_id` por `id`. El controlador nunca ve diferencias."

### 20.13 "¿Qué pasa si Mongo o Supabase está caído?"

> "El preflight `assertBrokerAndDatabasesReadiness` devuelve 503 antes de emitir órdenes o escribir. El servidor
> sigue vivo; solo se bloquean las operaciones que requieren esa BD."

### 20.14 "¿Por qué un puente Python para Webull e IBKR?"

> "Porque sus APIs oficiales requieren firma y socket que ya estaban resueltos en Python. El puente aísla esa
> complejidad, tiene timeout de 15 s y devuelve JSON por stdout. Node queda limpio de criptografía específica."

### 20.15 "¿Cuáles son los límites del core hoy?"

> "Tres: la cadena de opciones de Webull es sintética (no viene del libro real), el guardián CERO SIMULACIÓN solo
> cubre el auto-collar, y la autenticación no bloquea endpoints por defecto. Son mejoras identificadas, no fallas
> ocultas."

---

# 21. Glosario mínimo y checklist

## 21.1 Glosario

| Término | Definición |
|---|---|
| **Core** | Pipeline selección → valuación → estructuración → ejecución → verificación → persistencia |
| **F0** | Motor analítico Black-Scholes (precio, griegas, IV) |
| **F2** | Motor de estructuración y ejecución de coberturas |
| **Preflight** | Verificación previa de BD/broker antes de operar |
| **Guardrail** | Regla que bloquea una operación peligrosa |
| **DTO** | Objeto que normaliza la salida entre motores |
| **Repository** | Capa que abstrae el acceso a datos |
| **JSONB** | Tipo JSON binario de PostgreSQL |
| **Bridge** | Script Python que habla con un broker |
| **HMAC-SHA1** | Algoritmo de firma de Webull |
| **Matching engine** | Motor que casa órdenes en el broker |
| **Callback / claim** | Dato firmado dentro del JWT |
| **Fail closed** | Ante duda, no escribir ni ejecutar |

## 21.2 Checklist del core

- [ ] Sé dibujar el diagrama de infraestructura (Render, Cloudflare, Mongo, Supabase, brokers).
- [ ] Sé recitar los 12 pasos del flujo end-to-end.
- [ ] Sé explicar la precedencia de `dbTarget` y de `broker`.
- [ ] Sé explicar por qué el preflight va antes de ejecutar.
- [ ] Sé escribir la fórmula de `score` del auto-collar.
- [ ] Sé explicar el guardián CERO SIMULACIÓN y sus límites.
- [ ] Sé explicar la paridad Mongo/JSONB y el DTO.
- [ ] Sé explicar las 4 probabilidades del scanner.
- [ ] Sé nombrar las 12 discrepancias del capítulo 18.
- [ ] Tengo probado el flujo con Postman/Scalar al menos una vez.

## 21.3 La idea que debe quedar

> "El core no es una colección de endpoints: es una **cadena de custodia** de la decisión financiera.
> Cada núcleo recibe algo del anterior, lo transforma y lo entrega con evidencia. Si se rompe un eslabón,
> el sistema falla cerrado: no ejecuta y no escribe. Esa es la diferencia entre una demo y una infraestructura."

---

*Documento generado a partir del código real del repositorio `LSW-EQ1-PROYECTO`.
Referencias de línea corresponden al estado del repositorio al 2026-11-10.*
