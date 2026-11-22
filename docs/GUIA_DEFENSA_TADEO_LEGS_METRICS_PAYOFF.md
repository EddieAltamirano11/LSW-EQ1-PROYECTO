# Guía Maestra — Vertical Slice de José Tadeo Núñez Carvajal
## Ciclo de Vida de Estrategias, Subdocumento `legs`, Métricas Financieras y Curva de Payoff

**Proyecto:** Infraestructura RESTful para Coberturas Financieras de Opciones (Zero-Cost Collar & Protective Put)
**Materia:** Laboratorio de Servicios Web — TecNM IT Tepic
**Equipo:** Equipo 1 — Los Eddies
**Autor del slice:** José Tadeo Núñez Carvajal (23400585)
**Bloque de exposición:** 26:30 – 32:30 (6.0 minutos)

---

## Cómo usar este documento

Está escrito en el orden en que se debe estudiar:

1. **Capítulos 1–3:** fundamentos. Si ya dominas finanzas y REST, salta al 4.
2. **Capítulos 4–7:** arquitectura y modelo de datos. Es lo que te permite responder *cualquier* pregunta estructural.
3. **Capítulos 8–10:** recorrido del código endpoint por endpoint, con request/response reales.
4. **Capítulos 11–12:** matemáticas (métricas y payoff). Aquí está el 60 % de las preguntas del profesor.
5. **Capítulos 13–17:** pruebas, relación con otros módulos, preguntas de defensa, discrepancias y guion.

> **Advertencia importante:** este documento está basado en el **código real** del repositorio, no en la guía de exposición.
> En el capítulo 16 se listan las diferencias entre la guía y el código. Apréndelas: si el profesor las detecta y tú no,
> pierdes credibilidad; si tú las mencionas primero, ganas puntos de honestidad técnica.

---

# ÍNDICE

1. Resumen ejecutivo (pitch de 30 segundos)
2. Fundamentos financieros mínimos
3. Fundamentos técnicos mínimos (REST, capas, repositorio, contexto de BD)
4. Arquitectura del proyecto y ubicación de tu slice
5. El modelo de datos explicado campo por campo
6. Documento de ejemplo completo (Mongo y Supabase)
7. Las dos puertas de entrada: `/hedging` y `/hedging-strategies` / `/strategies`
8. Recorrido del código: capa por capa
9. Los 13 endpoints de tu slice, uno por uno (con cURL y respuestas)
10. Persistencia políglota en detalle
11. Matemáticas I: métricas de la posición
12. Matemáticas II: la matriz de Payoff
13. Ciclo de vida y baja lógica
14. Pruebas y verificación en vivo
15. Relación con los módulos de tus compañeros
16. Discrepancias guía ↔ código
17. Preguntas de defensa con respuesta modelo
18. Guion de 6 minutos, minuto a minuto
19. Glosario
20. Checklist final

---

# 1. Resumen ejecutivo (pitch de 30 segundos)

> "Mi módulo es el **gobierno de la posición cubierta**. Eddie estructura el collar y Jesús calcula las primas;
> yo soy quien **persiste las patas** (stock, put, call) como subdocumento, quien **cambia el estado** de la estrategia
> a lo largo de su ciclo de vida, y quien **traduce esas patas a números de negocio**: Delta neto, break-even,
> pérdida máxima y una curva de P&L de 25 puntos que el frontend grafica.
> Todo funciona igual sobre MongoDB y sobre PostgreSQL/Supabase gracias al patrón Repository."

Tres verbos que resumen tu slice: **persistir, transicionar, cuantificar**.

---

# 2. Fundamentos financieros mínimos

Si el profesor pregunta "explícame qué estás modelando", necesitas estos conceptos sin titubear.

## 2.1 Acción, opción, prima, strike, vencimiento

| Concepto | Definición operativa |
|---|---|
| **Acción (stock)** | Participación en una empresa. Su precio actual es el **spot** (`S0`). |
| **Opción** | Contrato que da un **derecho** (no obligación) sobre 100 acciones. |
| **Call** | Derecho a **comprar** a un precio fijo. Gana valor si la acción **sube**. |
| **Put** | Derecho a **vender** a un precio fijo. Gana valor si la acción **baja**. Sirve de seguro. |
| **Strike (`K`)** | Precio fijado en el contrato. |
| **Prima** | Precio que se paga (o cobra) por la opción. |
| **Vencimiento (`T`)** | Fecha en que el contrato expira. En EE. UU. es viernes hábil (CBOE). |
| **Contrato estándar** | 100 acciones por contrato. |
| **OTM (Out-of-the-Money)** | Put con `K < S0`; Call con `K > S0`. Son más baratas y son las que usa el collar. |

## 2.2 Protective Put (póliza de seguro)

Tienes 100 acciones de NVDA a $100. Compras un Put con strike $90 pagando $2.
Si NVDA cae a $70, ejerces el Put: vendes a $90 aunque el mercado esté a $70.
Tu pérdida queda acotada. Es literalmente un seguro: pagas una prima por un piso.

## 2.3 Covered Call (financiar el seguro)

Para no pagar la prima del Put de tu bolsillo, **vendes** un Call con strike $110 y cobras $2.
Renuncias a las ganancias por encima de $110, pero el dinero del Call paga el Put.

## 2.4 Collar de costo cero (lo que modela tu BD)

```
        COMPRAS 100 acciones        COMPRAS 1 Put (piso)      VENDES 1 Call (techo)
        S0 = $100                   K_put = $90, prima $2     K_call = $110, prima $2
                │                          │                          │
                └──────────────┬───────────┴──────────────────────────┘
                               ▼
                    ESTRATEGIA COLLAR (3 patas / legs)
                    Prima neta = $2 (cobrada) − $2 (pagada) = $0  →  COSTO CERO
```

Resultado: piso en $90, techo en $110, costo neto cero. Eso es el **Zero-Cost Collar**.

## 2.5 Las griegas (solo necesitas dominar Delta)

| Griega | Mide | Unidad intuitiva |
|---|---|---|
| **Delta (Δ)** | Cambio del precio de la opción por cada $1 que mueve la acción | Acciones equivalentes |
| Gamma (Γ) | Cambio de Delta por cada $1 | Curvatura |
| Theta (Θ) | Pérdida de valor por paso del tiempo | $/día |
| Vega (V) | Sensibilidad a la volatilidad implícita | $ por 1 % de vol |
| Rho (ρ) | Sensibilidad a la tasa libre de riesgo | $ por 1 % de tasa |

Reglas de signo que usarás todo el tiempo:

- Acción: **Δ = +1.0**
- Put comprado: **Δ negativa** (ej. −0.25). Protege en caídas.
- Call vendido: aporta **Δ positiva** al contrato, pero como lo **vendes**, se **resta** al portafolio.

## 2.6 Payoff, break-even, pérdida máxima

- **Payoff**: ganancia o pérdida de la estrategia en función del precio de la acción al vencimiento (`S_T`).
- **Break-even**: precio de `S_T` donde la P&L = 0.
- **Pérdida máxima**: lo peor que puede pasar. En un collar está **acotada** por el Put.
- **Ganancia máxima**: lo mejor que puede pasar. Está **acotada** por el Call vendido.

---

# 3. Fundamentos técnicos mínimos

## 3.1 REST en 10 líneas

- **Recurso** = sustantivo en plural (`/hedging`, `/legs`, `/financial-metrics`).
- **Verbo HTTP** = operación: `GET` lee, `POST` crea, `PUT` reemplaza/actualiza, `PATCH` ajusta un campo, `DELETE` elimina.
- **Sin estado**: cada petición lleva todo lo necesario (token, headers).
- **Códigos**: `200` OK, `201` creado, `400` datos inválidos, `401` no autenticado, `404` no existe, `409` conflicto/duplicado, `422` imposible matemáticamente, `500` error interno.
- **Jerarquía de recursos**: `/hedging/{id}/legs/{legId}` significa "la pata `legId` de la estrategia `id`".

## 3.2 Arquitectura en capas (la pregunta "¿cómo está organizado?")

```
┌─────────────────────────────────────────────────────────────┐
│  ROUTES        Define URL + verbo + controlador             │
│  src/api/v1/routes/leg.routes.js                            │
│  src/api/v1/routes/hedging.routes.js                        │
├─────────────────────────────────────────────────────────────┤
│  CONTROLLERS   Lee req, valida lo básico, llama al servicio │
│                y decide el código HTTP de respuesta          │
│  src/api/v1/controllers/leg.controller.js                   │
│  src/api/v1/controllers/hedging.controller.js               │
├─────────────────────────────────────────────────────────────┤
│  SERVICES      Reglas de negocio + orquestación             │
│  src/api/v1/services/hedging.service.js                     │
├─────────────────────────────────────────────────────────────┤
│  REPOSITORIES  Traducen operaciones a Mongoose o a Supabase │
│  hedging.repository.js  (selector)                          │
│  hedging.mongo.repo.js                                      │
│  hedging.supabase.repo.js                                   │
├─────────────────────────────────────────────────────────────┤
│  MODELS / DB   Mongoose Schema  |  Tablas PostgreSQL        │
│  HedgingStrategy.model.js                                   │
└─────────────────────────────────────────────────────────────┘
```

**Por qué importa:** el controlador **no sabe** si los datos viven en Mongo o Supabase. Solo pasa `req.dbTarget`.
Eso es inversión de dependencias aplicada de forma pragmática.

## 3.3 Patrón Repository (tu argumento estrella de arquitectura)

Archivo: `src/api/v1/repositories/hedging.repository.js`

```js
import { HedgingMongoRepository } from './hedging.mongo.repo.js';
import { HedgingSupabaseRepository } from './hedging.supabase.repo.js';

const mongoRepo = new HedgingMongoRepository();
const supabaseRepo = new HedgingSupabaseRepository();

export const getHedgingRepo = (dbTarget = 'mongodb') => {
  return dbTarget === 'supabase' ? supabaseRepo : mongoRepo;
};
```

Ambos repositorios exponen **la misma interfaz**:

```
getAll(filter)            create(data)             update(id, updates)      delete(id)
getUnderlyingSubdocument  updateUnderlyingSubdocument
getAllLegs                getLegById               addLeg                   addLegsBatch
updateLeg                 updateLegsBatch          deleteLeg                deleteLegsBatch
getMetrics                updateMetrics
```

**Frase de defensa:** "El servicio programa contra la interfaz del repositorio, no contra Mongo ni contra Postgres.
Agregar un tercer motor solo requiere implementar la interfaz y añadir un `case` al selector."

## 3.4 Contexto de base de datos: ¿quién decide Mongo o Supabase?

Archivo: `src/middlewares/databaseContext.middleware.js`

```js
export const databaseContextMiddleware = (req, res, next) => {
  const headerSelection = (req.headers['x-database-selection'] || req.headers['x-db-target'])?.toLowerCase();
  const tokenTarget = req.user?.dbTarget?.toLowerCase();
  const queryTarget = (req.query?.database || req.query?.dbTarget || req.query?.db)?.toLowerCase();

  let selected = 'mongodb';
  if (['mongodb', 'supabase'].includes(headerSelection)) selected = headerSelection;
  else if (['mongodb', 'supabase'].includes(tokenTarget)) selected = tokenTarget;
  else if (['mongodb', 'supabase'].includes(queryTarget)) selected = queryTarget;
  else if (req.body?.databaseTarget && ['mongodb','supabase'].includes(String(req.body.databaseTarget).toLowerCase()))
    selected = String(req.body.databaseTarget).toLowerCase();

  req.dbTarget = selected;
  if (req.body && typeof req.body === 'object') req.body.databaseTarget = selected;
  res.setHeader('X-Active-Database', selected);
  next();
};
```

**Orden de precedencia:** header > claim JWT > query string > body > `mongodb` por defecto.

Se monta en `src/app.js` después de la autenticación:

```js
app.use(authMiddleware);
app.use(databaseContextMiddleware);
app.use(brokerContextMiddleware);
```

**Consecuencia para tu slice:** todos tus controladores reciben `req.dbTarget` ya resuelto y lo pasan tal cual
al servicio. Nunca decides tú la base.

## 3.5 Manejo de errores: Boom + un único errorHandler

Archivo: `src/middlewares/errorHandler.middleware.js`

```js
export const errorHandler = (err, req, res, next) => {
  let error = err;
  if (!boom.isBoom(error)) {
    if (error.statusCode || error.status) {
      error = boom.boomify(error, { statusCode: error.statusCode || error.status });
    } else if (error.name === 'ValidationError') {
      error = boom.badRequest(error.message);        // Mongoose validation → 400
    } else if (error.code === 11000) {
      error = boom.conflict('Llave duplicada en la base de datos.'); // Mongo duplicate → 409
    } else {
      error = boom.badImplementation(error.message || 'Error interno del servidor.');
    }
  }
  const { output } = error;
  res.status(output.statusCode).json({
    ...output.payload,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    activeDatabase: req.dbTarget || 'unknown',
  });
};
```

Esto explica tres cosas que puedes presumir:

1. Los errores de validación de Mongoose **no** se convierten en 500: se convierten en **400**.
2. Los duplicados de Mongo (código `11000`) se convierten en **409**.
3. Toda respuesta de error incluye `activeDatabase` y `path` → **observabilidad**.

---

# 4. Arquitectura del proyecto y ubicación de tu slice

## 4.1 Archivos que son TUYOS (los que debes poder abrir sin buscar)

| Archivo | Rol |
|---|---|
| `src/api/v1/models/HedgingStrategy.model.js` | Define el documento, el subdocumento `legs[]` y `financialMetrics` |
| `src/api/v1/routes/leg.routes.js` | Rutas de patas bajo `/strategies/:id/legs` (incluye `reorder` y `ratio`) |
| `src/api/v1/controllers/leg.controller.js` | Controladores de esas rutas |
| `src/api/v1/controllers/hedging.controller.js` (sección legs/metrics/payoff) | Controladores bajo `/hedging/:id/...` |
| `src/api/v1/services/hedging.service.js` (secciones legs/metrics/payoff) | Lógica de negocio de tu slice |
| `src/api/v1/repositories/hedging.mongo.repo.js` | Implementación Mongo |
| `src/api/v1/repositories/hedging.supabase.repo.js` | Implementación PostgreSQL |
| `spec/openspec.yaml` (secciones 5 y 6) | Contrato OpenAPI de tus endpoints |

> La guía menciona `src/api/v1/controllers/financial-metrics.controller.js`. **Ese archivo no existe.**
> Las métricas viven en `hedging.controller.js` y en `analytics.controller.js`. Dilo así si te preguntan por archivos.

## 4.2 Montaje de rutas (importante para no equivocarte en la demo)

Archivo: `src/api/v1/routes/index.js`

```js
router.use('/hedging', hedgingRoutes);
router.use('/hedging-strategies', hedgingRoutes);   // alias
router.use('/strategies', strategyRoutes);
```

Archivo: `src/api/v1/routes/strategy.routes.js`

```js
router.use('/:id/legs', legRoutes);                 // → /api/v1/strategies/:id/legs
```

Entonces **tu CRUD de patas existe en tres prefijos**:

```
/api/v1/hedging/:id/legs...            → hedging.controller  (el que usa el Postman del equipo)
/api/v1/hedging-strategies/:id/legs... → hedging.controller  (alias del anterior)
/api/v1/strategies/:id/legs...         → leg.controller      (incluye extras)
```

**Respuesta de defensa:** "Es un alias de compatibilidad de contrato v1. La lógica es una sola:
ambos controladores llaman al mismo `HedgingService` y al mismo repositorio."

## 4.3 Diferencias entre `hedging.controller` y `leg.controller`

`leg.controller.js` es más permisivo y tiene dos endpoints extra:

| Endpoint | Controlador | Extra |
|---|---|---|
| `POST /legs/batch` | `leg.controller` | Acepta `{ legs: [...] }` **o** un arreglo crudo |
| `PUT /legs/reorder` | `leg.controller` | Reordena el arreglo de patas |
| `PATCH /legs/:legId/ratio` | `leg.controller` | Ajusta `ratio`/`quantity` |

En cambio `hedging.controller.addLegsBatch` pasa `req.body` directo al servicio, y el repositorio hace
`legsArray.map(...)`. **Consecuencia práctica: bajo `/hedging/:id/legs/batch` el body debe ser un arreglo crudo**, no `{legs:[]}`.
(= `[ {...}, {...} ]`, no `{ "legs": [ ... ] }`). Memorízalo para la demo.

---

# 5. El modelo de datos explicado campo por campo

Archivo: `src/api/v1/models/HedgingStrategy.model.js`

## 5.1 Estructura general

```js
const hedgingStrategySchema = new mongoose.Schema({
  _id: { type: String, required: true },        // ID de negocio, NO ObjectId
  portfolioId: { type: String, required: true },
  broker: { type: String, enum: ['ALPACA','IBKR','WEBULL','SIMULATED'], default: 'ALPACA' },
  strategyType: { type: String, enum: ['PROTECTIVE_PUT','COLLAR','COLLAR_SPREAD'] },
  status: { type: String, enum: ['ACTIVE','CLOSED','EXPIRED'], default: 'ACTIVE' },
  underlying: { type: underlyingSubSchema, required: true },   // subdocumento
  legs: { type: [legSchema], required: true },                 // arreglo de subdocumentos
  financialMetrics: { type: financialMetricsSubSchema, required: true },
  deletedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false, collection: 'hedging_strategies' });
```

## 5.2 `underlyingSubSchema` (contexto del activo)

```js
{
  symbol: String,             // "NVDA"
  companyName: String,        // "NVIDIA Corporation"
  spotPriceAtEntry: Number,   // S0 al momento de estructurar
  sharesCount: Number,        // 100 acciones
}
```

## 5.3 `legSchema` — el corazón de tu módulo

```js
const legSchema = new mongoose.Schema({
  legId: { type: String, required: true },     // "LEG-NVDA-PUT"
  legRole: {
    type: String, required: true,
    enum: ['UNDERLYING','HEDGE_FLOOR','FINANCE_CEILING','STOCK','LONG_PUT','SHORT_CALL'],
  },
  assetType: { type: String, required: true, enum: ['EQUITY','OPTION'] },
  contractSymbol: { type: String, default: null },  // "NVDA261016P00090000" (formato OCC)
  brokerOrderId: { type: String, default: null },   // ID real del matching engine
  optionType: { type: String, enum: ['CALL','PUT',null], default: null },
  strike: { type: Number, default: null },
  expirationDate: { type: Date, default: null },
  quantity: { type: Number, required: true, min: 1 },
  entryPrice: { type: Number, required: true, min: 0 },
  delta: { type: Number, default: 0.0 },
  gamma: { type: Number, default: 0.0 },
  theta: { type: Number, default: 0.0 },
  vega: { type: Number, default: 0.0 },
}, { _id: false });
```

### Tabla de campos (lo que debes poder explicar)

| Campo | Tipo | Obligatorio | Para qué sirve | Ejemplo |
|---|---|---|---|---|
| `legId` | String | Sí | Identidad de la pata dentro del arreglo | `LEG-NVDA-PUT` |
| `legRole` | Enum | Sí | **Rol financiero**: qué hace esta pata en la estrategia | `HEDGE_FLOOR` |
| `assetType` | Enum | Sí | Distingue acción de opción | `OPTION` |
| `contractSymbol` | String | No | Símbolo OCC para enviar la orden al broker | `NVDA261016P00090000` |
| `brokerOrderId` | String | No | Evidencia de ejecución real (regla CERO SIMULACIÓN) | `DEV4Q8EB` |
| `optionType` | Enum | No | `CALL` o `PUT` | `PUT` |
| `strike` | Number | No | Precio de ejercicio | `90` |
| `expirationDate` | Date | No | Vencimiento | `2026-10-16` |
| `quantity` | Number | Sí | Contratos o acciones (mínimo 1) | `1` |
| `entryPrice` | Number | Sí | Prima pagada/cobrada o precio de la acción (mínimo 0) | `2.15` |
| `delta/gamma/theta/vega` | Number | No | Griegas **persistidas** al momento del alta | `-0.2105` |

### Los seis valores de `legRole` (pregunta casi segura)

| `legRole` | Significado | Delta que aporta | Signo en el flujo de caja |
|---|---|---|---|
| `UNDERLYING` | Las 100 acciones | +1.0 | Pagas `S0 × acciones` |
| `HEDGE_FLOOR` | Put comprado (piso) | Negativo (−0.1 a −0.4) | Pagas prima (débito) |
| `FINANCE_CEILING` | Call vendido (techo) | Positivo pero **se resta** | Cobras prima (crédito) |
| `STOCK` | Alias de acciones | +1.0 | — |
| `LONG_PUT` | Alias de `HEDGE_FLOOR` | Negativo | Débito |
| `SHORT_CALL` | Alias de `FINANCE_CEILING` | Positivo (se resta) | Crédito |

**Por qué hay alias:** los repositorios y el servicio aceptan ambos vocabularios
(`leg.legRole === 'HEDGE_FLOOR' || leg.role === 'LONG_PUT'`) para no romper documentos históricos
ni payloads del frontend que usan la nomenclatura larga. Es **compatibilidad hacia atrás**.

## 5.4 `financialMetricsSubSchema`

```js
{
  netDebitCredit: Number,        // + crédito / − débito neto en USD
  breakevenPrice: Number,        // precio de equilibrio
  floorProtectionPrice: Number,  // K_put (piso blindado)
  maxLossTotalUSD: Number,       // pérdida máxima acotada
  netDelta: Number,              // delta agregada de la posición
}
```

> El spec OpenAPI declara además `ceilingCapPrice` y `maxProfitTotalUSD`. El modelo Mongoose **no** los declara
> en el schema, pero Mongoose en modo no estricto por defecto sobre `save()` los guarda igual (el schema no usa `strict:false`,
> pero el alta los inyecta en `createCollarSpread`). En la práctica viajan en MongoDB y en el JSON de respuesta.
> Si te preguntan: "el contrato expone maxProfit y ceiling; el schema base declara los cinco campos obligatorios."

## 5.5 Detalles de Mongoose que sí debes saber

**`_id: String`:** el ID lo genera el servicio (`STRAT-COLLAR-NVDA-a1b2`) o un UUID. No es ObjectId.
Ventaja: el mismo ID funciona en Postgres y en el frontend sin conversión.

**`{ _id: false }` en `legSchema`:** Mongo no crea un `_id` por pata. La identidad es `legId`, lo que hace
que el JSON sea idéntico al de Postgres (que no tiene `_id`).

**`toJSON.transform`:**

```js
hedgingStrategySchema.set('toJSON', {
  transform: (_doc, ret) => {
    const id = ret._id;
    delete ret._id;
    return { id, ...ret };
  },
});
```

Cambia `_id` por `id`. Resultado: el frontend **nunca** ve diferencias entre motores.

**Índices:**

```js
hedgingStrategySchema.index({ portfolioId: 1, status: 1 });
hedgingStrategySchema.index({ 'underlying.symbol': 1 });
```

El primero acelera "dame las estrategias activas de este portafolio"; el segundo, "dame las estrategias de NVDA"
(consulta sobre campo de subdocumento).

---

# 6. Documento de ejemplo completo

## 6.1 En MongoDB (`hedging_strategies`)

```json
{
  "_id": "STRAT-COLLAR-NVDA-a1b2",
  "portfolioId": "PORT-TECH-01",
  "broker": "WEBULL",
  "strategyType": "COLLAR",
  "status": "ACTIVE",
  "underlying": {
    "symbol": "NVDA",
    "companyName": "NVIDIA Corporation",
    "spotPriceAtEntry": 100,
    "sharesCount": 100
  },
  "legs": [
    {
      "legId": "LEG-NVDA-STOCK",
      "legRole": "UNDERLYING",
      "assetType": "EQUITY",
      "contractSymbol": null,
      "brokerOrderId": "DEV4Q8EA",
      "optionType": null,
      "strike": null,
      "expirationDate": null,
      "quantity": 100,
      "entryPrice": 100,
      "delta": 1,
      "gamma": 0,
      "theta": 0,
      "vega": 0
    },
    {
      "legId": "LEG-NVDA-PUT",
      "legRole": "HEDGE_FLOOR",
      "assetType": "OPTION",
      "contractSymbol": "NVDA261016P00090000",
      "brokerOrderId": "DEV4Q8EB",
      "optionType": "PUT",
      "strike": 90,
      "expirationDate": "2026-10-16T00:00:00.000Z",
      "quantity": 1,
      "entryPrice": 2,
      "delta": -0.25,
      "gamma": 0.02,
      "theta": -0.04,
      "vega": 0.12
    },
    {
      "legId": "LEG-NVDA-CALL",
      "legRole": "FINANCE_CEILING",
      "assetType": "OPTION",
      "contractSymbol": "NVDA261016C00110000",
      "brokerOrderId": "DEV4Q8EC",
      "optionType": "CALL",
      "strike": 110,
      "expirationDate": "2026-10-16T00:00:00.000Z",
      "quantity": 1,
      "entryPrice": 2,
      "delta": 0.35,
      "gamma": 0.02,
      "theta": -0.03,
      "vega": 0.11
    }
  ],
  "financialMetrics": {
    "netDebitCredit": 0,
    "breakevenPrice": 100,
    "floorProtectionPrice": 90,
    "maxLossTotalUSD": 1000,
    "maxProfitTotalUSD": 1000,
    "netDelta": 0.4
  },
  "deletedAt": null,
  "createdAt": "2026-11-09T18:00:00.000Z",
  "updatedAt": "2026-11-09T18:00:00.000Z"
}
```

## 6.2 En Supabase (`tbl_hedging_strategies`)

| Columna | Valor |
|---|---|
| `id` | `3f8a1c2e-...-uuid` |
| `portfolio_id` | `c0000000-0000-0000-0000-000000000001` |
| `underlying_id` | UUID del subyacente en `tbl_underlyings` |
| `strategy_type` | `COLLAR` |
| `status` | `ACTIVE` |
| `shares_count` | `100` |
| `legs_config` | **JSONB con el mismo arreglo `legs`** |
| `financial_metrics` | **JSONB con las métricas + `broker`** |
| `broker` | `WEBULL` (columna física, con fallback a JSONB si no existe) |

El adaptador `mapFromSupabase` devuelve **exactamente** la misma forma que Mongo:

```js
const mapFromSupabase = (row) => ({
  id: row.id,
  portfolioId: row.portfolio_id,
  broker: row.broker || row.financial_metrics?.broker || 'ALPACA',
  underlyingId: row.underlying_id,
  strategyType: row.strategy_type,
  status: row.status,
  underlying: {
    symbol: uData.symbol || stockLeg?.legId?.split('-')?.[1] || row.underlying?.symbol || 'AAPL',
    companyName: uData.companyName || `${sym} Inc.`,
    sharesCount: uData.sharesCount || row.shares_count || stockLeg?.quantity || 100,
    spotPriceAtEntry: uData.spotPriceAtEntry || stockLeg?.entryPrice || row.spot_price_at_entry || 100.0,
  },
  legs: row.legs_config || [],
  financialMetrics: row.financial_metrics || {},
  createdAt: row.created_at,
});
```

**Detalle crítico:** `getById` en Supabase valida que el ID sea un **UUID**:

```js
if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
```

Por eso, si estás en `supabase` **no puedes usar** un ID tipo `STRAT-COLLAR-NVDA-a1b2`: debes usar el UUID de la fila.
En Mongo sí puedes usar el ID de negocio **o** el `portfolioId` (porque `getById` busca con `$or`).

---

# 7. Las dos puertas de entrada

## 7.1 `/api/v1/hedging/:id/...` (la que usa Postman)

`src/api/v1/routes/hedging.routes.js`

```js
// === SUBDOCUMENTO: LEGS (ARREGLO DE OBJETOS) ===
router.get('/:id/legs', HedgingController.getLegsList);
router.get('/:id/legs/:legId', HedgingController.getLegById);
router.post('/:id/legs', HedgingController.addSingleLeg);
router.post('/:id/legs/batch', HedgingController.addLegsBatch);
router.put('/:id/legs/batch', HedgingController.updateLegsBatch);
router.put('/:id/legs/:legId', HedgingController.updateSingleLeg);
router.delete('/:id/legs/batch', HedgingController.deleteLegsBatch);
router.delete('/:id/legs/:legId', HedgingController.deleteSingleLeg);

// === SUBDOCUMENTO: METRICS & PAYOFF ===
router.get('/:id/financial-metrics', HedgingController.getStrategyMetrics);
router.put('/:id/financial-metrics/recalculate', HedgingController.recalculateMetrics);
router.get('/:id/payoff-matrix', HedgingController.getPayoffMatrix);

// Estrategia
router.get('/:id', HedgingController.getStrategyById);
router.put('/:id/status', HedgingController.updateStrategyStatus);
router.delete('/:id', HedgingController.deleteStrategy);
```

**Orden de rutas:** las rutas literales (`/batch`) están declaradas **antes** de las paramétricas (`/:legId`).
Si estuvieran al revés, Express interpretaría `"batch"` como un `legId`. Ese es un detalle de diseño que puedes mencionar.

## 7.2 `/api/v1/strategies/:id/legs` (leg.controller)

```js
const router = Router({ mergeParams: true });

router.get('/', LegController.getLegsList);
router.post('/', LegController.addSingleLeg);
router.post('/batch', LegController.addLegsBatch);
router.put('/reorder', LegController.reorderLegs);
router.get('/:legId', LegController.getLegById);
router.put('/:legId', LegController.updateSingleLeg);
router.patch('/:legId/ratio', LegController.updateLegRatio);
router.delete('/:legId', LegController.deleteSingleLeg);
```

**`mergeParams: true`**: sin esto, el router hijo no vería el `:id` de la estrategia definido en el padre.
Es la respuesta exacta a "¿por qué el controlador puede leer `req.params.id` si la ruta del hijo no lo declara?".

---

# 8. Recorrido del código: capa por capa

Tomemos **una** petición y sigámosla completa. Es la mejor forma de demostrar que entiendes el flujo.

## Petición

```http
POST /api/v1/hedging/STRAT-COLLAR-NVDA-a1b2/legs
x-database-selection: mongodb
Content-Type: application/json

{
  "legRole": "HEDGE_FLOOR",
  "assetType": "OPTION",
  "optionType": "PUT",
  "strike": 88,
  "quantity": 1,
  "entryPrice": 1.75,
  "delta": -0.22,
  "gamma": 0.03,
  "theta": -0.05,
  "vega": 0.14
}
```

## Paso 0 — Middlewares globales

1. `authMiddleware`: si hay `Authorization: Bearer <jwt>` válido, deja `req.user` con los claims (incluido `dbTarget`). Si no hay token, **deja pasar como anónimo**.
2. `databaseContextMiddleware`: resuelve `req.dbTarget` (aquí, por header → `mongodb`) y responde con `X-Active-Database: mongodb`.

## Paso 1 — Ruta

`hedging.routes.js` casa el patrón `POST /:id/legs` → `HedgingController.addSingleLeg`.

## Paso 2 — Controlador

```js
export const addSingleLeg = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leg = await HedgingService.addSingleLeg(id, req.body, req.dbTarget);
    res.status(201).json({
      message: 'Pata individual agregada exitosamente a la estrategia.',
      leg,
    });
  } catch (error) {
    next(error);
  }
};
```

Observa las tres responsabilidades del controlador: **leer entrada**, **delegar**, **elegir código HTTP**.
No valida reglas de negocio ni habla con la base.

## Paso 3 — Servicio

```js
export const addSingleLeg = async (strategyId, legData, dbTarget = 'mongodb') => {
  const repo = getHedgingRepo(dbTarget);
  const leg = await repo.addLeg(strategyId, legData);
  if (!leg) throw boom.notFound(`Estrategia '${strategyId}' no encontrada para agregar pata.`);
  return leg;
};
```

Aquí está la **regla de negocio**: si la estrategia no existe, se lanza un 404 semántico (`boom.notFound`).
Sin `if (!leg)`, el cliente recibiría un `200` con `null` (mentira).

## Paso 4 — Repositorio Mongo

```js
async addLeg(strategyId, legData) {
  const strat = await this.getById(strategyId);
  if (!strat) return null;

  const legId = legData.legId || `LEG-${randomUUID().slice(0, 6)}`;
  const normalized = {
    assetType: legData.assetType || (legData.optionType ? 'OPTION' : 'EQUITY'),
    legRole: ['UNDERLYING','HEDGE_FLOOR','FINANCE_CEILING','STOCK','LONG_PUT','SHORT_CALL'].includes(legData.legRole)
      ? legData.legRole
      : (legData.optionType === 'PUT' ? 'HEDGE_FLOOR'
        : (legData.optionType === 'CALL' ? 'FINANCE_CEILING' : 'UNDERLYING')),
    quantity: Number(legData.quantity || legData.contracts || legData.sharesCount || 1),
    entryPrice: Number(legData.entryPrice ?? legData.premium ?? legData.price ?? 0),
    ...legData,
    legId,
  };

  strat.legs.push(normalized);
  await strat.save();
  return strat.legs.find((l) => l.legId === legId);
}
```

Lo que hace, en orden:

1. **Busca la estrategia** (y filtra `deletedAt: null`).
2. **Genera `legId`** si no vino.
3. **Normaliza**: si no mandaste `legRole`, lo infiere de `optionType`; acepta `quantity|contracts|sharesCount`;
   acepta `entryPrice|premium|price`.
4. **Hace `push`** al arreglo y guarda.
5. **Devuelve solo la pata creada** (no toda la estrategia).

## Paso 5 — Respuesta

```http
HTTP/1.1 201 Created
X-Active-Database: mongodb

{
  "message": "Pata individual agregada exitosamente a la estrategia.",
  "leg": {
    "legId": "LEG-2f9a1c",
    "legRole": "HEDGE_FLOOR",
    "assetType": "OPTION",
    "optionType": "PUT",
    "strike": 88,
    "quantity": 1,
    "entryPrice": 1.75,
    "delta": -0.22,
    "gamma": 0.03,
    "theta": -0.05,
    "vega": 0.14
  }
}
```

> Nota: como el `legId` no vino en el body, el servidor lo generó con `randomUUID().slice(0,6)`.
> **El cliente debe leer el `legId` de la respuesta** para luego hacer `PUT`/`DELETE` sobre esa pata.

## Paso 6 — Si algo falla

| Situación | Dónde se detecta | Respuesta |
|---|---|---|
| Estrategia inexistente | Servicio (`!leg`) | `404` con `"Estrategia ... no encontrada"` |
| `legRole` fuera del enum | Mongoose al `save()` | `400` (ValidationError → boom.badRequest) |
| `quantity < 1` | Mongoose (`min: 1`) | `400` |
| `entryPrice < 0` | Mongoose (`min: 0`) | `400` |
| `assetType` ausente | Mongoose (`required`) | `400` |
| Token inválido/expirado | `authMiddleware` | `401` |
| Fallo de conexión a Mongo | Repositorio | `500` |

---

# 9. Los 13 endpoints de tu slice, uno por uno

Base URL local: `http://localhost:3000/api/v1` (o la de Render: `https://lsw-eq1-proyecto.onrender.com/api/v1`).
Header recomendado en todas: `x-database-selection: mongodb`.

---

## 9.1 `GET /hedging/:id/legs` — Listar patas

**Cadena:** ruta → `getLegsList` → `HedgingService.getLegsList` → `repo.getAllLegs` → `strat.legs`.

```bash
curl -X GET "$BASE/hedging/STRAT-COLLAR-NVDA-a1b2/legs" \
  -H "x-database-selection: mongodb"
```

**Respuesta `200`** (arreglo crudo, sin envoltorio):

```json
[
  { "legId": "LEG-NVDA-STOCK", "legRole": "UNDERLYING", "assetType": "EQUITY", "quantity": 100, "entryPrice": 100, "delta": 1 },
  { "legId": "LEG-NVDA-PUT", "legRole": "HEDGE_FLOOR", "assetType": "OPTION", "optionType": "PUT", "strike": 90, "quantity": 1, "entryPrice": 2, "delta": -0.25 },
  { "legId": "LEG-NVDA-CALL", "legRole": "FINANCE_CEILING", "assetType": "OPTION", "optionType": "CALL", "strike": 110, "quantity": 1, "entryPrice": 2, "delta": 0.35 }
]
```

**Error `404`** si la estrategia no existe (`legs` es `null`).

**Qué defender:** "Devuelvo el arreglo, no un objeto paginado, porque las patas de una estrategia son un conjunto
pequeño y acotado (3–4 elementos); paginar aquí sería sobreingeniería."

---

## 9.2 `GET /hedging/:id/legs/:legId` — Pata individual

```bash
curl -X GET "$BASE/hedging/STRAT-COLLAR-NVDA-a1b2/legs/LEG-NVDA-PUT" \
  -H "x-database-selection: mongodb"
```

**Respuesta `200`:**

```json
{
  "legId": "LEG-NVDA-PUT",
  "legRole": "HEDGE_FLOOR",
  "assetType": "OPTION",
  "optionType": "PUT",
  "strike": 90,
  "quantity": 1,
  "entryPrice": 2,
  "delta": -0.25
}
```

**Error `404`:** `"Pata 'LEG-XXX' no encontrada en la estrategia '...'"`.

**Detalle:** en Mongo la búsqueda es `strat.legs.find(l => l.legId === legId)` (igualdad estricta).
En Supabase acepta además `l.role === legId` (compatibilidad). No prometas búsqueda parcial: es exacta.

---

## 9.3 `POST /hedging/:id/legs` — Crear pata

```bash
curl -X POST "$BASE/hedging/STRAT-COLLAR-NVDA-a1b2/legs" \
  -H "Content-Type: application/json" \
  -H "x-database-selection: mongodb" \
  -d '{
    "legRole": "HEDGE_FLOOR",
    "assetType": "OPTION",
    "optionType": "PUT",
    "strike": 88,
    "quantity": 1,
    "entryPrice": 1.75,
    "delta": -0.22
  }'
```

**Respuesta `201`:** `{ "message": "...", "leg": { ...con legId generado... } }`.

**Validaciones reales (importante, no inventes un Joi que no existe):**

- En `hedging.controller` **no hay validación previa**; el body va directo al servicio.
- En `leg.controller` sí hay una comprobación mínima:
  ```js
  if (!legData || !legData.assetType) {
    throw boom.badRequest('El objeto de pierna debe especificar al menos assetType (ej: OPTION, EQUITY).');
  }
  ```
- La validación fuerte es del **schema de Mongoose** (enum de `legRole`, `assetType`, mínimos).
- En Supabase **no hay validación de schema** en la escritura (JSONB acepta lo que sea). Ese es un punto débil
  que puedes reconocer: la integridad en Supabase depende del servicio, no de la base.

---

## 9.4 `POST /hedging/:id/legs/batch` — Crear lote

> **Body = arreglo crudo** (no `{legs: [...]}`) en esta ruta.

```bash
curl -X POST "$BASE/hedging/STRAT-COLLAR-NVDA-a1b2/legs/batch" \
  -H "Content-Type: application/json" \
  -H "x-database-selection: mongodb" \
  -d '[
    { "legRole": "HEDGE_FLOOR", "assetType": "OPTION", "optionType": "PUT",  "strike": 90,  "quantity": 1, "entryPrice": 2.0 },
    { "legRole": "FINANCE_CEILING", "assetType": "OPTION", "optionType": "CALL", "strike": 110, "quantity": 1, "entryPrice": 2.0 }
  ]'
```

**Respuesta `201`:**

```json
{
  "message": "Lote de patas agregado a la estrategia.",
  "legs": [ /* arreglo completo actualizado */ ]
}
```

**Por qué devuelve el arreglo completo:** después de una operación masiva, el cliente necesita el estado
consistente del recurso; devolver solo lo insertado lo obligaría a un `GET` extra.

**Si usas el alias `/strategies/:id/legs/batch`:** ahí sí puedes mandar `{ "legs": [ ... ] }` **o** el arreglo crudo,
porque `leg.controller` normaliza:

```js
const { legs } = req.body;
const legsArray = Array.isArray(legs) ? legs : req.body;
```

---

## 9.5 `PUT /hedging/:id/legs/:legId` — Actualizar pata

```bash
curl -X PUT "$BASE/hedging/STRAT-COLLAR-NVDA-a1b2/legs/LEG-NVDA-PUT" \
  -H "Content-Type: application/json" \
  -H "x-database-selection: mongodb" \
  -d '{ "strike": 89, "entryPrice": 2.10, "delta": -0.27 }'
```

**Respuesta `200`:** `{ "message": "Pata actualizada.", "leg": { ...actualizada... } }`.

**Cómo funciona en Mongo:**

```js
async updateLeg(strategyId, legId, legUpdates) {
  const strat = await this.getById(strategyId);
  if (!strat) return null;
  const leg = strat.legs.find((l) => l.legId === legId);
  if (!leg) return null;
  Object.assign(leg, legUpdates);
  await strat.save();
  return leg;
}
```

**Riesgo que debes conocer:** `Object.assign` permite sobrescribir `legId` (cambiar la identidad de la pata).
No hay whitelist de campos. Si el profesor pregunta por seguridad de entrada: "es una mejora pendiente;
hoy la protección es el enum y los mínimos del schema, no una lista blanca de campos actualizables."

En Supabase el update es read-modify-write del JSONB (`legs_config`), no un `UPDATE ... WHERE legId`.
Eso implica que dos updates concurrentes pueden pisarse (last-write-wins).

---

## 9.6 `PUT /hedging/:id/legs/batch` — Actualizar lote

```bash
curl -X PUT "$BASE/hedging/STRAT-COLLAR-NVDA-a1b2/legs/batch" \
  -H "Content-Type: application/json" \
  -H "x-database-selection: mongodb" \
  -d '[
    { "legId": "LEG-NVDA-PUT",  "delta": -0.28 },
    { "legId": "LEG-NVDA-CALL", "delta": 0.31 }
  ]'
```

**Respuesta `200`:**

```json
{
  "message": "Patas actualizadas en bloque.",
  "modifiedCount": 2,
  "legs": [ /* arreglo completo */ ]
}
```

`modifiedCount` cuenta cuántas patas coincidieron por `legId`. Las que no existen **se ignoran silenciosamente**
(no lanzan 404). Es una decisión de diseño: en lote, tolerancia a fallos parciales.

---

## 9.7 `DELETE /hedging/:id/legs/:legId` — Eliminar pata

```bash
curl -X DELETE "$BASE/hedging/STRAT-COLLAR-NVDA-a1b2/legs/LEG-NVDA-CALL" \
  -H "x-database-selection: mongodb"
```

**Respuesta `200`:**

```json
{
  "message": "Pata eliminada del arreglo legs.",
  "deletedLegId": "LEG-NVDA-CALL",
  "remainingCount": 2
}
```

**Implementación Mongo:**

```js
const initialLen = strat.legs.length;
strat.legs = strat.legs.filter((l) => l.legId !== legId);
if (strat.legs.length === initialLen) return null;   // no existía → 404
await strat.save();
return { deletedLegId: legId, remainingCount: strat.legs.length };
```

**Concepto que debes nombrar:** esto es un **borrado físico de la pata dentro de un borrado lógico de la estrategia**.
La estrategia nunca se destruye (`deletedAt`), pero la pata sí desaparece del arreglo.
El "cascade delete" del que habla la guía es **implícito**: al borrar la estrategia, las patas se van con el documento
porque están embebidas.

---

## 9.8 `DELETE /hedging/:id/legs/batch` — Eliminar lote

```bash
curl -X DELETE "$BASE/hedging/STRAT-COLLAR-NVDA-a1b2/legs/batch" \
  -H "Content-Type: application/json" \
  -H "x-database-selection: mongodb" \
  -d '{ "legIds": ["LEG-NVDA-PUT", "LEG-NVDA-CALL"] }'
```

**Respuesta `200`:** `{ "message": "Lote de patas eliminado.", "deletedCount": 2, "remainingCount": 1 }`.

**Ojo con el body:** aquí sí es **objeto** con `legIds`, no arreglo crudo. El controlador hace:

```js
const { legIds } = req.body;
```

---

## 9.9 `PUT /hedging/:id/status` — Transición de estado

```bash
curl -X PUT "$BASE/hedging/STRAT-COLLAR-NVDA-a1b2/status" \
  -H "Content-Type: application/json" \
  -H "x-database-selection: mongodb" \
  -d '{ "status": "CLOSED" }'
```

**Respuesta `200`:** `{ "message": "Estado de la estrategia actualizado.", "data": { ...estrategia... } }`.

**Cadena:** `updateStrategyStatus(id, status, dbTarget)` → `repo.update(id, { status })` →
`findOneAndUpdate(..., { $set: status }, { new: true, runValidators: true })`.

**Valores válidos (Mongoose):** `ACTIVE`, `CLOSED`, `EXPIRED`. `runValidators: true` hace que un valor inválido
produzca `400`, no un `200` silencioso.

**En Supabase no hay enum:** `status` es texto libre. Si el profesor pregunta por la integridad del estado
en el motor relacional, reconócelo: "en Postgres el enum está en la aplicación; en Mongo está en el schema".

---

## 9.10 `DELETE /hedging/:id` — Baja lógica de la estrategia

```bash
curl -X DELETE "$BASE/hedging/STRAT-COLLAR-NVDA-a1b2" \
  -H "x-database-selection: mongodb"
```

**Mongo:**

```js
async delete(id) {
  return await HedgingStrategy.findOneAndUpdate(
    { $or: [{ _id: id }, { portfolioId: id }], deletedAt: null },
    { $set: { deletedAt: new Date(), status: 'CLOSED' } },
    { new: true }
  );
}
```

**Supabase:**

```js
async delete(id) {
  const { data, error } = await client
    .from('tbl_hedging_strategies')
    .update({ status: 'CLOSED' })
    .eq('id', id)
    .select()
    .single();
  ...
}
```

**Diferencia honesta:** Mongo marca `deletedAt` y **todas las lecturas filtran `deletedAt: null`**.
Supabase solo cambia `status`; la fila sigue visible en `getAll` (que no filtra por estado).
Respuesta de defensa: "el borrado lógico está completo en Mongo; en Supabase es un cierre por estado,
y el filtrado por estado se hace en la consulta (`?status=CLOSED`)".

---

## 9.11 `GET /hedging/:id/financial-metrics` — Leer métricas

```bash
curl -X GET "$BASE/hedging/STRAT-COLLAR-NVDA-a1b2/financial-metrics" \
  -H "x-database-selection: mongodb"
```

**Respuesta `200`** (objeto crudo):

```json
{
  "netDebitCredit": 0,
  "breakevenPrice": 100,
  "floorProtectionPrice": 90,
  "maxLossTotalUSD": 1000,
  "maxProfitTotalUSD": 1000,
  "netDelta": 0.4
}
```

**Error `404`:** `"Métricas no encontradas para la estrategia '...'"`.

**Diferencia con `/strategies/:id/financial-metrics`:** ese otro endpoint (`analytics.controller`)
llama al **mismo** servicio. No hay dos implementaciones.

---

## 9.12 `PUT /hedging/:id/financial-metrics/recalculate` — Recalcular

```bash
curl -X PUT "$BASE/hedging/STRAT-COLLAR-NVDA-a1b2/financial-metrics/recalculate" \
  -H "Content-Type: application/json" \
  -H "x-database-selection: mongodb" \
  -d '{ "currentSpotPrice": 105.5 }'
```

**Respuesta `200`:**

```json
{
  "message": "Métricas analíticas recalculadas exitosamente.",
  "financialMetrics": {
    "netDebitCredit": 0,
    "floorProtectionPrice": 90,
    "netDelta": 0.4,
    "recalculatedAt": "2026-11-09T18:30:00.000Z"
  }
}
```

**Código real:**

```js
export const recalculateMetrics = async (strategyId, { currentSpotPrice } = {}, dbTarget = 'mongodb') => {
  const strategy = await getStrategyById(strategyId, dbTarget);
  const spot = currentSpotPrice ? Number(currentSpotPrice) : strategy.underlying.spotPriceAtEntry;
  const legs = strategy.legs || [];

  let netDebitCredit = 0;
  let netDelta = 0;
  let floor = null;

  for (const leg of legs) {
    if (leg.legRole === 'UNDERLYING') {
      netDelta += (leg.delta || 1.0);
    } else if (leg.legRole === 'HEDGE_FLOOR' || leg.role === 'LONG_PUT') {
      floor = leg.strike;
      netDelta += (leg.delta || -0.32);
      netDebitCredit -= (leg.entryPrice || leg.premium || 0) * (strategy.underlying.sharesCount || 100);
    } else if (leg.legRole === 'FINANCE_CEILING' || leg.role === 'SHORT_CALL') {
      netDelta -= (leg.delta || 0.25);
      netDebitCredit += (leg.entryPrice || leg.premium || 0) * (strategy.underlying.sharesCount || 100);
    }
  }

  const updatedMetrics = {
    netDebitCredit: Number(netDebitCredit.toFixed(2)),
    floorProtectionPrice: floor || strategy.financialMetrics.floorProtectionPrice,
    netDelta: Number(netDelta.toFixed(4)),
    recalculatedAt: new Date().toISOString(),
  };

  const repo = getHedgingRepo(dbTarget);
  return await repo.updateMetrics(strategyId, updatedMetrics);
};
```

**Lo que hace:** recalcula crédito neto, piso y delta neto **a partir de las patas persistidas**.

**Lo que NO hace (dilo tú antes de que te lo pregunten):**

1. **No reprecio con Black-Scholes.** Usa los `delta` guardados en cada pata.
2. **No usa `currentSpotPrice`**: `spot` se calcula y no se usa después. Es un parámetro reservado para la versión
   con reprecio.
3. **No actualiza `breakevenPrice` ni `maxLossTotalUSD`**; esos quedan como se calcularon en el alta.
4. Usa `sharesCount` (no `contratos × 100`) para multiplicar primas; con 100 acciones y 1 contrato coincide,
   pero conceptualmente habría que separar unidades.

**Frase de defensa:** "El endpoint recalcula las tres métricas que cambian con la posición (crédito, piso, delta).
El reprecio completo con volatilidad y spot actuales está identificado como evolución; hoy las primas y griegas
se congelan al alta para que la contabilidad de la posición sea auditable."

---

## 9.13 `GET /hedging/:id/payoff-matrix` — Matriz de P&L

```bash
curl -X GET "$BASE/hedging/STRAT-COLLAR-NVDA-a1b2/payoff-matrix?steps=25&rangePct=0.25" \
  -H "x-database-selection: mongodb"
```

**Respuesta `200`:**

```json
{
  "strategyId": "STRAT-COLLAR-NVDA-a1b2",
  "symbol": "NVDA",
  "spotPriceAtEntry": 100,
  "strategyType": "COLLAR",
  "stepsCount": 26,
  "points": [
    { "simulatedSpot": 75,  "unhedgedPL": -2500, "hedgedPL": -1000, "differenceUSD": 1500 },
    { "simulatedSpot": 80,  "unhedgedPL": -2000, "hedgedPL": -1000, "differenceUSD": 1000 },
    { "simulatedSpot": 85,  "unhedgedPL": -1500, "hedgedPL": -1000, "differenceUSD": 500 },
    { "simulatedSpot": 90,  "unhedgedPL": -1000, "hedgedPL": -1000, "differenceUSD": 0 },
    { "simulatedSpot": 95,  "unhedgedPL": -500,  "hedgedPL": -500,  "differenceUSD": 0 },
    { "simulatedSpot": 100, "unhedgedPL": 0,     "hedgedPL": 0,     "differenceUSD": 0 },
    { "simulatedSpot": 105, "unhedgedPL": 500,   "hedgedPL": 500,   "differenceUSD": 0 },
    { "simulatedSpot": 110, "unhedgedPL": 1000,  "hedgedPL": 1000,  "differenceUSD": 0 },
    { "simulatedSpot": 115, "unhedgedPL": 1500,  "hedgedPL": 1000,  "differenceUSD": -500 },
    { "simulatedSpot": 120, "unhedgedPL": 2000,  "hedgedPL": 1000,  "differenceUSD": -1000 },
    { "simulatedSpot": 125, "unhedgedPL": 2500,  "hedgedPL": 1000,  "differenceUSD": -1500 }
  ]
}
```

(Ejemplo con `steps=10` para la tabla; con `steps=25` salen 26 puntos con incrementos de $2.)

**Campo `differenceUSD`:** `hedgedPL − unhedgedPL`. Positivo = la cobertura te **ahorró** dinero (caídas);
negativo = la cobertura te **costó** upside (subidas). Es literalmente el "valor del seguro" en cada escenario.

---

# 10. Persistencia políglota en detalle

## 10.1 Tabla comparativa

| Operación | MongoDB | Supabase/PostgreSQL |
|---|---|---|
| Listar patas | `strat.legs` (arreglo embebido) | `row.legs_config` (JSONB) |
| Insertar pata | `strat.legs.push()` + `save()` | `legs_config = [...actuales, nueva]` + `update` |
| Actualizar pata | `Object.assign(leg)` + `save()` | `map` sobre el arreglo + `update` |
| Eliminar pata | `filter` + `save()` | `filter` + `update` |
| Métricas | `financialMetrics` (subdocumento) | `financial_metrics` (JSONB) |
| Baja de estrategia | `deletedAt` + `status=CLOSED` (filtra lecturas) | solo `status=CLOSED` |
| Validación al escribir | Schema Mongoose (enum, `required`, `min`) | Ninguna en BD (la pone el servicio) |
| Identidad | `_id` String o `legId` | `id` UUID o `legId` |

## 10.2 Por qué NO hay tabla `tbl_legs`

La guía dice "tabla foránea `tbl_legs`". El código **no** la usa. La representación relacional elegida es
**JSONB en la misma fila** de `tbl_hedging_strategies`.

Argumento técnico (y honesto) para defenderlo:

> "Modelé las patas como composición, no como entidad independiente. En Mongo eso es `embedding`; en Postgres
> la traducción natural es una columna JSONB. Una tabla `tbl_legs` habría exigido JOIN, transacción y borrado
> en cascada para reconstruir un objeto que siempre se lee junto. El DTO del repositorio garantiza que el
> contrato REST sea idéntico en ambos motores."

Si el profesor prefiere normalización relacional, responde: "es una decisión consciente de diseño orientada al
contrato; normalizar `tbl_legs` es viable y sería el siguiente paso si se requirieran consultas analíticas
por pata (por ejemplo, 'todas las patas PUT con strike 90 en todas las estrategias')."

## 10.3 El costo real de JSONB (dilo tú)

- No hay integridad referencial por pata.
- No hay índice por `strike` dentro del JSONB (habría que crear un índice GIN).
- Concurrencia: read-modify-write → last-write-wins.
- Migrar un campo de la pata requiere actualizar todos los documentos.

En Mongo el costo es similar salvo que sí tienes validación de schema y `$push`/`$pull` atómicos si usarías
operadores de actualización (el código actual hace `push` en memoria + `save()`, que también es atómico
a nivel documento).

---

# 11. Matemáticas I: métricas de la posición

## 11.1 Cómo se calculan en el alta (collar)

Archivo: `src/api/v1/services/hedging.service.js`, líneas 284–305.

```js
const K_put  = Number(putStrike);
const K_call = Number(callStrike);
const p_put  = Number(putPremium);
const p_call = Number(callPremium);
const count  = Number(payload.sharesCount || 100);
const contracts = Math.max(1, Math.ceil(count / 100));

if (K_put  >= S) throw boom.badRequest('El Strike del Put protector debe ser inferior al precio Spot (Out-of-the-Money).');
if (K_call <= S) throw boom.badRequest('El Strike del Call financiador debe ser superior al precio Spot (Out-of-the-Money).');

const netCreditPerShare = p_call - p_put;
const netDebitCreditTotal = Number((netCreditPerShare * count).toFixed(2));
const breakeven   = Number((S - netCreditPerShare).toFixed(2));
const maxLossUSD  = Number(((S - K_put  - netCreditPerShare) * count).toFixed(2));
const maxProfitUSD= Number(((K_call - S + netCreditPerShare) * count).toFixed(2));
const netDelta    = Number((1.0 + putQuant.greeks.delta - callQuant.greeks.delta).toFixed(4));
```

## 11.2 Las cinco fórmulas

```
Crédito neto por acción   c = p_call − p_put
Crédito/Débito total      N = c × acciones
Break-even                BE = S0 − c
Pérdida máxima            MaxLoss  = (S0 − K_put  − c) × acciones
Ganancia máxima           MaxProfit= (K_call − S0 + c) × acciones
Delta neto                Δ_neto   = 1.0 + Δ_put − Δ_call
```

## 11.3 Interpretación de cada una

**Crédito neto (`c`)**
Positivo → la estrategia te **paga** (el call financió más que el costo del put).
Negativo → pagaste un **débito** (el seguro costó más de lo que financiaste).
Cero → **Zero-Cost Collar** puro.

**Break-even (`BE`)**
Si `c > 0`, el crédito baja tu punto de equilibrio: `BE = S0 − c < S0`.
Si `c < 0`, lo sube: `BE = S0 + |c|`.
Intuición: si te pagaron por armar la cobertura, empiezas ganando; si pagaste, necesitas que la acción suba para recuperar la prima.

**Pérdida máxima**
`(S0 − K_put − c) × acciones`. Es el peor escenario, y se alcanza para **cualquier** `S_T ≤ K_put`.
Por eso la curva de payoff es **plana** a la izquierda: aunque la acción caiga a cero, el put te deja vender a `K_put`.

**Ganancia máxima**
`(K_call − S0 + c) × acciones`. Se alcanza para **cualquier** `S_T ≥ K_call`.
La curva es **plana** a la derecha: renunciaste a todo lo que suba por encima del strike del call.

**Delta neto**
`1.0 + Δ_put − Δ_call`. Con `Δ_put ≈ −0.25` y `Δ_call ≈ 0.35`:
`1.0 − 0.25 − 0.35 = +0.40`.
Interpretación: por cada $1 que sube la acción, la posición vale ~$0.40 (por acción) **hoy**, no al vencimiento.
Es una medida instantánea, no un payoff.

## 11.4 Ejemplo A — Collar de costo cero

| Parámetro | Valor |
|---|---|
| `S0` | $100 |
| `K_put` | $90 |
| `K_call` | $110 |
| `p_put` | $2.00 |
| `p_call` | $2.00 |
| Acciones | 100 |
| `Δ_put` | −0.25 |
| `Δ_call` | +0.35 |

```
c = 2.00 − 2.00 = 0
N = 0 × 100 = $0
BE = 100 − 0 = $100
MaxLoss = (100 − 90 − 0) × 100 = $1,000
MaxProfit = (110 − 100 + 0) × 100 = $1,000
Δ_neto = 1.0 − 0.25 − 0.35 = +0.40
```

Verificación: en `S_T = 70` la P&L es `(70 − 100 + 20 + 0) × 100 = −$1,000` ✔ (piso).
En `S_T = 120` es `(120 − 100 − 10 + 0) × 100 = +$1,000` ✔ (techo).

## 11.5 Ejemplo B — Collar con crédito neto

| Parámetro | Valor |
|---|---|
| `S0` | $100 |
| `K_put` | $90 |
| `K_call` | $112 |
| `p_put` | $1.50 |
| `p_call` | $3.50 |
| Acciones | 100 |

```
c = 3.50 − 1.50 = $2.00 por acción (crédito)
N = +$200
BE = 100 − 2 = $98          ← empiezas ganando desde $98
MaxLoss = (100 − 90 − 2) × 100 = $800
MaxProfit = (112 − 100 + 2) × 100 = $1,400
```

Verificación: `S_T = 70` → `(70 − 100 + 20 + 2) × 100 = −$800` ✔
`S_T = 98` → `(98 − 100 + 0 + 2) × 100 = 0` ✔ (break-even)
`S_T = 120` → `(120 − 100 − 8 + 2) × 100 = +$1,400` ✔

**Este ejemplo es oro para la exposición:** demuestra que entiendes el efecto del crédito en las tres métricas.

## 11.6 Ejemplo C — Protective Put (sin call)

```
MaxLoss = (S0 − K_put) × 100 + prima pagada
```
No hay techo: la ganancia es ilimitada. Delta neto ≈ `1.0 + Δ_put` (más cerca de 1, más exposición alcista).
La curva de payoff es plana a la izquierda y con pendiente 1:1 a la derecha.

## 11.7 Convención de signos (donde casi todos se equivocan)

| Concepto | Positivo significa | Negativo significa |
|---|---|---|
| `netDebitCredit` | Cobraste crédito | Pagaste débito |
| `differenceUSD` | La cobertura te ahorró | La cobertura te costó upside |
| `hedgedPL` | Ganancia | Pérdida |
| `Δ_put` | (no ocurre en un put comprado) | Protección en caídas |
| `Δ_call` almacenada | Prima del call (positiva) | (no ocurre) |
| Aporte del call al `Δ_neto` | — | Se **resta** porque está **vendido** |

---

# 12. Matemáticas II: la matriz de Payoff

Archivo: `src/api/v1/services/hedging.service.js`, líneas 1269–1322.

## 12.1 Código completo comentado

```js
export const generatePayoffMatrix = async (strategyId, { steps = 25, rangePct = 0.25 } = {}, dbTarget = 'mongodb') => {
  const strategy = await getStrategyById(strategyId, dbTarget);

  // 1. Datos base de la posición
  const S0     = Number(strategy.underlying.spotPriceAtEntry || 100);
  const shares = Number(strategy.underlying.sharesCount || 100);

  // 2. Saneamiento de parámetros (clamps)
  const numSteps    = Math.max(5, Math.min(100, Number(steps) || 25));
  const validRangePct = (Number(rangePct) > 0.01 && Number(rangePct) <= 2.0) ? Number(rangePct) : 0.25;

  // 3. Construcción del rango de precios simulados
  const minPrice = Math.max(0.01, S0 * (1 - validRangePct));
  const maxPrice = S0 * (1 + validRangePct);
  const stepSize = Math.max(0.01, (maxPrice - minPrice) / numSteps);

  // 4. Extracción de las patas de opción
  const putLeg  = (strategy.legs || []).find((l) => l.legRole === 'HEDGE_FLOOR'    || l.role === 'LONG_PUT');
  const callLeg = (strategy.legs || []).find((l) => l.legRole === 'FINANCE_CEILING'|| l.role === 'SHORT_CALL');

  const K_put  = putLeg  ? Number(putLeg.strike  || 0) : 0;
  const P_put  = putLeg  ? Number(putLeg.entryPrice || putLeg.premium || 0) : 0;
  const K_call = callLeg ? Number(callLeg.strike || 0) : 0;
  const P_call = callLeg ? Number(callLeg.entryPrice || callLeg.premium || 0) : 0;

  // 5. Prima neta por acción (crédito del call menos costo del put)
  const netPremiumPerShare = (callLeg ? P_call : 0) - (putLeg ? P_put : 0);

  // 6. Barrido de escenarios
  const points = [];
  for (let S_T = minPrice; S_T <= maxPrice + (stepSize * 0.1); S_T += stepSize) {
    const unhedgedPL = (S_T - S0) * shares;                 // acción sola

    let optionPayoff = 0;
    if (putLeg && K_put > 0 && S_T < K_put) {
      optionPayoff += (K_put - S_T);                        // put ejercido: ganas K_put − S_T
    }
    if (callLeg && K_call > 0 && S_T > K_call) {
      optionPayoff -= (S_T - K_call);                       // call asignado: pierdes S_T − K_call
    }

    const hedgedPL = (S_T - S0 + optionPayoff + netPremiumPerShare) * shares;

    points.push({
      simulatedSpot: Number(S_T.toFixed(2)),
      unhedgedPL:    Number(unhedgedPL.toFixed(2)),
      hedgedPL:      Number(hedgedPL.toFixed(2)),
      differenceUSD: Number((hedgedPL - unhedgedPL).toFixed(2)),
    });
  }

  return {
    strategyId, symbol: strategy.underlying.symbol,
    spotPriceAtEntry: S0, strategyType: strategy.strategyType,
    stepsCount: points.length, points,
  };
};
```

## 12.2 La ecuación nodo por nodo

**Acción sin cobertura:**
```
unhedgedPL(S_T) = (S_T − S0) × acciones
```
Es una recta con pendiente `acciones`. Si `S_T = 0`, pierdes todo el capital.

**Put comprado (piso):**
```
payoff_put(S_T) = max(0, K_put − S_T)
```
Vale 0 si la acción está arriba del strike; vale `K_put − S_T` si está abajo.

**Call vendido (techo):**
```
payoff_call(S_T) = −max(0, S_T − K_call)
```
Vale 0 si la acción está debajo del strike; te cuesta `S_T − K_call` si está arriba.

**Prima neta:**
```
netPremiumPerShare = P_call − P_put
```
Crédito del call que cobras, menos la prima del put que pagas.

**Estrategia completa:**
```
hedgedPL(S_T) = [ (S_T − S0) + max(0, K_put − S_T) − max(0, S_T − K_call) + (P_call − P_put) ] × acciones
```

**Diferencia (valor de la cobertura):**
```
differenceUSD(S_T) = hedgedPL(S_T) − unhedgedPL(S_T)
                   = [ max(0, K_put − S_T) − max(0, S_T − K_call) + (P_call − P_put) ] × acciones
```
Nota: la diferencia **no depende de S0**, solo de los strikes, las primas y `S_T`. Es la P&L de las opciones solas.

## 12.3 Forma de la curva (lo que debes dibujar en el pizarrón)

```
P&L
 │                                        ╱ sin cobertura (recta)
 │                                   ╱────
 │                            ╱────        ┌──── techo (call vendido)
 │                       ╱────             │
 │                  ╱────                  │
 │             ╱────                       │
 │        ╱────                            │
 │   ╱────                                 │
 │────  ┌──────────────────────────────────┘
 │      │  piso (put comprado)
 └──────┴───────┴──────────┴──────────┴──────────► S_T
       K_put    S0        K_call
```

Tres zonas:

1. **`S_T < K_put`** → pendiente **0**. La P&L es constante: `(K_put − S0 + c) × acciones`. Es la **pérdida máxima**.
2. **`K_put ≤ S_T ≤ K_call`** → pendiente **+1** (por acción). La P&L sigue a la acción.
3. **`S_T > K_call`** → pendiente **0**. La P&L es constante: `(K_call − S0 + c) × acciones`. Es la **ganancia máxima**.

Ese "peldaño" es la firma visual del collar. Si el profesor te pide "dibújame el payoff", dibujas esto y marcas
los tres tramos con sus fórmulas.

## 12.4 Tabla de puntos de ejemplo (Ejemplo A, steps=10)

Rango: `[75, 125]`, `stepSize = 5`.

| `S_T` | `unhedgedPL` | `hedgedPL` | `differenceUSD` | Zona |
|---:|---:|---:|---:|---|
| 75 | −2,500 | −1,000 | +1,500 | piso |
| 80 | −2,000 | −1,000 | +1,000 | piso |
| 85 | −1,500 | −1,000 | +500 | piso |
| 90 | −1,000 | −1,000 | 0 | frontera piso |
| 95 | −500 | −500 | 0 | pendiente |
| 100 | 0 | 0 | 0 | break-even |
| 105 | +500 | +500 | 0 | pendiente |
| 110 | +1,000 | +1,000 | 0 | frontera techo |
| 115 | +1,500 | +1,000 | −500 | techo |
| 120 | +2,000 | +1,000 | −1,000 | techo |
| 125 | +2,500 | +1,000 | −1,500 | techo |

Observa: `hedgedPL` es **constante** en −1,000 por debajo de 90 y **constante** en +1,000 por encima de 110.
Exactamente `maxLoss` y `maxProfit` calculados en 11.4. **La consistencia entre las métricas y la matriz es tu mejor prueba de que el modelo es correcto.**

## 12.5 Parámetros y saneamiento

| Parámetro | Default | Rango permitido | Qué pasa si mandas algo inválido |
|---|---|---|---|
| `steps` | 25 | 5 – 100 | Se recorta al límite (`clamp`) |
| `rangePct` | 0.25 | 0.01 – 2.0 | Se usa 0.25 |

**Detalle fino:** con `steps = 25` el bucle es **inclusivo** en ambos extremos, así que produce **26 puntos**
(25 intervalos). El campo se llama `stepsCount` justamente para no mentir. Si te preguntan "¿por qué 26 y no 25?",
respondes: "`steps` es el número de **intervalos**; los puntos son `steps + 1` por inclusión del extremo superior".

## 12.6 Casos borde que el código maneja

| Caso | Comportamiento |
|---|---|
| Estrategia sin put | `K_put = 0`, no hay piso; la P&L sigue a la acción |
| Estrategia sin call | `K_call = 0`, no hay techo; ganancia ilimitada |
| Sin patas de opción | `hedgedPL = unhedgedPL`; diferencia 0 |
| `spotPriceAtEntry` ausente | Usa 100 por defecto |
| `sharesCount` ausente | Usa 100 por defecto |
| `rangePct` enorme | Se rechaza (>2.0) y se usa 0.25 |
| `steps` negativo | Se recorta a 5 |

## 12.7 Qué NO es esta matriz (para no sobrevender)

- **No es una simulación Monte Carlo.** Es un **barrido determinista** de precios al vencimiento.
- **No usa Black-Scholes.** Asume que al vencimiento la opción vale su valor intrínseco (correcto por definición).
- **No modela tiempo ni volatilidad.** Solo el precio final `S_T`.
- **No incluye comisiones ni impuestos.**
- **No valúa la posición antes del vencimiento** (para eso está `simulate-f0-f2` de Jesús, que sí modela días transcurridos).

Si te preguntan "¿por qué no usas Black-Scholes aquí?", la respuesta correcta es:
"Al vencimiento no hay prima extrínseca: Black-Scholes converge al valor intrínseco. Usar BS sería redundante
y añadiría error numérico. BS se usa al **alta** para las griegas y para el reprecio antes del vencimiento."

---

# 13. Ciclo de vida y baja lógica

## 13.1 Estados reales

```
        ┌──────────┐   PUT /status   ┌──────────┐
        │  ACTIVE  │ ───────────────►│  CLOSED  │
        └──────────┘                 └──────────┘
             │
             │ PUT /status
             ▼
        ┌──────────┐
        │ EXPIRED  │
        └──────────┘
```

- `ACTIVE`: la cobertura está vigente (estado inicial).
- `CLOSED`: se desmontó la posición (o se dio de baja la estrategia).
- `EXPIRED`: venció sin cierre explícito.

**No existe `PENDING`.** La guía lo menciona, el código no. Si el profesor pregunta por la máquina de estados,
di la verdad: "el estado nace `ACTIVE` cuando el broker confirma las órdenes (regla CERO SIMULACIÓN);
el enum restringe los valores y la baja lógica pasa a `CLOSED`".

## 13.2 Baja lógica

Mongo:
```js
{ $set: { deletedAt: new Date(), status: 'CLOSED' } }
```
Y **todas** las lecturas filtran `deletedAt: null`:
```js
const query = { deletedAt: null, ...filter };
```

Supabase: solo `status = 'CLOSED'` (no hay `deletedAt` en el mapeo).

**Por qué baja lógica y no física:** trazabilidad financiera. Un registro de cobertura es evidencia de una
operación real; borrarlo destruiría la auditoría. Es el mismo principio que un asiento contable: se marca, no se borra.

## 13.3 Cascada implícita

Al borrar la estrategia, las patas **no** requieren borrado explícito porque están **embebidas**:
el documento desaparece completo. Eso es una ventaja del embedding frente a `tbl_legs` con `ON DELETE CASCADE`.
Menciónalo: "la cascada es estructural, no procedural".

---

# 14. Pruebas y verificación en vivo

## 14.1 Flujo reproducible de 90 segundos (para la demo)

```bash
BASE="https://lsw-eq1-proyecto.onrender.com/api/v1"
ID="STRAT-COLLAR-NVDA-a1b2"     # usa uno real de tu BD
H="x-database-selection: mongodb"

# 1) Ver las patas actuales
curl -s "$BASE/hedging/$ID/legs" -H "$H"

# 2) Agregar una pata de prueba
curl -s -X POST "$BASE/hedging/$ID/legs" -H "$H" -H "Content-Type: application/json" \
  -d '{"legRole":"FINANCE_CEILING","assetType":"OPTION","optionType":"CALL","strike":115,"quantity":1,"entryPrice":1.2,"delta":0.28}'

# 3) Ver métricas
curl -s "$BASE/hedging/$ID/financial-metrics" -H "$H"

# 4) Recalcular
curl -s -X PUT "$BASE/hedging/$ID/financial-metrics/recalculate" -H "$H" -H "Content-Type: application/json" \
  -d '{"currentSpotPrice":105}'

# 5) Payoff de 25 intervalos
curl -s "$BASE/hedging/$ID/payoff-matrix?steps=25&rangePct=0.25" -H "$H"

# 6) Cambiar estado
curl -s -X PUT "$BASE/hedging/$ID/status" -H "$H" -H "Content-Type: application/json" -d '{"status":"ACTIVE"}'

# 7) Limpiar la pata de prueba (usa el legId que devolvió el paso 2)
curl -s -X DELETE "$BASE/hedging/$ID/legs/LEG-xxxxxx" -H "$H"
```

**Consejo de demo:** haz el `POST` y el `DELETE` sobre una estrategia de prueba, no sobre la que vas a usar
para el payoff. Deja el payoff para el final y **proyecta la tabla de puntos**, no solo el JSON crudo.

## 14.2 Verificación en Scalar

`https://lsw-eq1-proyecto.onrender.com/api/v1/docs` → busca el tag **Subdocumentos** y **Métricas & Analítica**.
Scalar te permite pegar el `id` y ejecutar. Es la forma más limpia de mostrar el contrato OpenAPI en vivo.

## 14.3 Verificación en Postman

La colección usa el alias `/api/v1/hedging-strategies/...`. Carpeta
**"SECCIÓN 5: OPERACIONES CON SUBDOCUMENTOS (LEGS, UNDERLYING, METRICS & PAYOFF)"**.
Los requests 5.x cubren GET legs, GET leg, POST leg, PUT leg, DELETE leg, metrics, recalculate y payoff.

## 14.4 Qué pruebas existen en el repo y qué cubren

Los 8 archivos de `test/`:

| Archivo | Tipo | Cubre tu slice |
|---|---|---|
| `test/api.contract-functional.test.js` | Contrato/functional | Spec, códigos 400/401, health, docs, paridad de contexto |
| `test/quant.unit.test.js` | Unitario | Payoff comparativo de la estrategia (`comparativePayoff`) |
| `test/black-scholes.validation.test.js` | Integración | Validaciones del motor F0 |
| `test/underlying.integration.test.js` | Integración | CRUD de subyacentes |
| `test/scanner.v2.test.js` | Integración | Screener v2 |
| `test/login.*.test.js` | Integración | Auth y sesión |
| `test/context.unit.test.js` | Unitario | Middleware de contexto |

**Honestidad:** no hay un archivo de test dedicado exclusivamente a `legs/batch` o `recalculate`.
Si te preguntan "¿tus endpoints están probados?", responde: "están cubiertos por la suite de contrato
(200, 400, 401, 404) y verificados en la colección Postman de 108 requests; un test unitario específico
del payoff está en `quant.unit.test.js` a través de `comparativePayoff`".

---

# 15. Relación con los módulos de tus compañeros

## 15.1 Jesús (motor F0) → tú

Jesús produce `delta`, `gamma`, `theta`, `vega` por pata. Esos valores se **persisten** en `legSchema` al crear la
estrategia (en `createCollarSpread` y `createProtectivePut`). Tu `recalculateMetrics` los **consume**, no los recalcula.

```
quant.service.calculateBlackScholes()  →  leg.delta  →  netDelta = 1 + Δ_put − Δ_call
```

También consumes su `calculateStrategyGreeks(strategy)` si el endpoint `/strategies/:id/calculate-greeks` se usa,
pero ese es de su slice; tú solo debes saber que existe.

## 15.2 Eddie (auto-collar) → tú

Eddie crea el documento completo (`createCollarSpread`) con las tres patas y las métricas iniciales.
Tu slice **gobierna después**: agrega/quita patas, cambia estado, recalcula.

```
Eddie: POST /hedging/auto-collar       → crea estrategia + legs + metrics
Tadeo: GET  /hedging/:id/legs          → inspecciona
Tadeo: PUT  /hedging/:id/status        → activa/cierra
Tadeo: GET  /hedging/:id/payoff-matrix → grafica
```

**Transición de exposición:** "Eddie estructuró; yo gobierno el estado y la contabilidad de la posición."

## 15.3 Karime (screener) → tú

Karime usa `N(d2)` del motor de Jesús para rankear. Tú no interactúas directamente, pero el mismo `quant.service`
alimenta ambos. Si te preguntan, di: "compartimos el motor F0; ella lo usa para probabilidad, yo para griegas y payoff".

## 15.4 Luis (broker) → tú

Luis produce `brokerOrderId` reales. Ese campo vive en `legSchema` y es la **evidencia de ejecución** que tu
documento persiste. La regla CERO SIMULACIÓN se apoya en que tú guardas el `orderId` oficial por pata.
Si el broker no confirma, no hay `leg` que persistir (el guardián de `hedging.service.js` aborta antes).

**Frase:** "Yo soy el libro contable de la cobertura; Luis es quien aporta la evidencia de que la orden existió."

---

# 16. Discrepancias guía ↔ código

Esta tabla es tu seguro de credibilidad. **Memorízala.**

| # | La guía dice | El código hace | Cómo responder |
|---|---|---|---|
| 1 | Máquina de estados `PENDING → ACTIVE → CLOSED` | Enum real: `ACTIVE`, `CLOSED`, `EXPIRED`. **No existe `PENDING`** | "El estado nace ACTIVE cuando el broker confirma; el enum restringe los valores." |
| 2 | Tabla `tbl_legs` en PostgreSQL | Columna JSONB **`legs_config`** en `tbl_hedging_strategies` | "La representación relacional es JSONB; el DTO garantiza paridad." |
| 3 | Payoff fijo en `[0.70·S0, 1.30·S0]` | `rangePct` configurable, default **0.25** → `[0.75·S0, 1.25·S0]` | "Rango parametrizable por query string; default ±25 %." |
| 4 | Archivo `financial-metrics.controller.js` | **No existe**; está en `hedging.controller.js` y `analytics.controller.js` | Nombra los archivos reales. |
| 5 | "Inserción atómica" de piernas | Mongo: `push` + `save()` (atómico a nivel documento). Supabase: read-modify-write de JSONB | "Atómico a nivel documento en Mongo; en Supabase es un update de columna." |
| 6 | "25 puntos" | El bucle inclusivo devuelve **26** puntos (25 intervalos) | "`steps` son intervalos; los puntos son `steps + 1`." |
| 7 | Validación con Joi/Boom de legs | Boom solo en el servicio (404) y comprobación mínima de `assetType` en `leg.controller`. El resto es **schema Mongoose** | "La validación fuerte es declarativa en el schema; Boom cubre reglas de negocio." |
| 8 | Recalcular "ante fluctuaciones de spot" | `currentSpotPrice` se recibe pero **no se usa**; no hay reprecio BS | "Hoy recalcula crédito, piso y delta desde las patas; el reprecio con spot es evolución." |
| 9 | `DELETE` con "limpieza en cascada" | Mongo: baja lógica (`deletedAt`) y las patas se van con el documento. Supabase: solo `status=CLOSED` | "La cascada es estructural por embedding; en Supabase es cierre por estado." |
| 10 | Spec OpenAPI: `status` incluye `EXERCISED` | El modelo Mongoose **no** incluye `EXERCISED` | "El contrato declara EXERCISED; el schema operativo maneja los tres estados vigentes. Es una diferencia a reconciliar." |
| 11 | Spec OpenAPI: payoff con `spotAtExpiry`, `stockPnL`, `optionsPnL`, `netStrategyPnL` | La respuesta real usa `simulatedSpot`, `unhedgedPL`, `hedgedPL`, `differenceUSD` | "El contrato y la implementación divergen en nombres; la implementación es la fuente de verdad para el frontend." |
| 12 | `POST /legs/batch` con `{legs:[]}` | Bajo `/hedging` exige **arreglo crudo**; bajo `/strategies` acepta ambos | "Depende del alias; `/strategies` normaliza y `/hedging` pasa el body directo." |

> **Regla de oro:** si el profesor detecta una de estas y tú la niegas, pierdes. Si la mencionas antes,
> demuestras que conoces tu código mejor que la guía de exposición.

---

# 17. Preguntas de defensa con respuesta modelo

### 17.1 "¿Por qué las patas son un subdocumento y no una colección aparte?"

> "Porque son **composición**: una pata no existe sin su estrategia. Embeberlas me da lectura en una sola query,
> escritura atómica a nivel documento y una baja en cascada estructural. Si necesitara consultas analíticas
> transversales por pata (por ejemplo, 'todas las patas PUT con strike 90'), normalizaría; hoy el acceso siempre
> es por estrategia."

### 17.2 "¿Cómo garantizas que Mongo y Supabase devuelvan lo mismo?"

> "Con el patrón Repository y un DTO. `mapFromSupabase` traduce snake_case a camelCase y rearma `legs` desde
> `legs_config`; Mongoose usa `toJSON.transform` para cambiar `_id` por `id`. El controlador nunca ve diferencias,
> así que el contrato REST es idéntico."

### 17.3 "¿Qué pasa si dos usuarios editan la misma pata al mismo tiempo?"

> "En Mongo, cada `save()` es atómico a nivel documento: gana la última escritura, pero no se corrompe el arreglo.
> En Supabase es read-modify-write del JSONB, así que también es last-write-wins. Para concurrencia real usaría
> versionado optimista (`__v` en Mongo, columna `version` en Postgres) y un `409` en conflicto."

### 17.4 "¿Cómo se calcula el Delta neto y por qué el call se resta?"

> "Δ_neto = 1.0 (acción) + Δ_put − Δ_call. El put comprado aporta delta negativa, que reduce la exposición.
> El call tiene delta positiva, pero como lo **vendemos**, su contribución al portafolio es negativa.
> Ejemplo: 1.0 − 0.25 − 0.35 = +0.40."

### 17.5 "Explícame el break-even y la pérdida máxima."

> "Break-even = S0 − crédito neto por acción. Si el collar te pagó $2, empiezas a ganar desde S0 − 2.
> Pérdida máxima = (S0 − K_put − crédito neto) × acciones. Está acotada porque el put te da derecho a vender
> a K_put aunque la acción caiga a cero. La curva de payoff es plana a la izquierda exactamente en ese valor."

### 17.6 "¿Por qué el payoff tiene forma de peldaño?"

> "Tres zonas: debajo de K_put la P&L es constante porque el put fija el piso; entre K_put y K_call la P&L
> sigue a la acción con pendiente 1; arriba de K_call es constante porque el call vendido fija el techo.
> Ese escalón es la firma visual del collar."

### 17.7 "¿Por qué no usas Black-Scholes en la matriz de payoff?"

> "Porque el payoff se evalúa **al vencimiento**, donde la opción vale su valor intrínseco y la prima extrínseca
> es cero. Black-Scholes converge exactamente a eso. Usarlo añadiría error numérico sin aportar información.
> BS sí se usa al alta (griegas) y en el reprecio antes del vencimiento."

### 17.8 "¿Qué pasa si la estrategia no tiene put o no tiene call?"

> "El código lo maneja: sin put, `K_put = 0` y no hay piso; sin call, `K_call = 0` y no hay techo.
> Si no hay ninguna opción, `hedgedPL` es igual a `unhedgedPL` y `differenceUSD` es cero en todos los puntos.
> La matriz no falla, simplemente describe una posición sin cobertura."

### 17.9 "¿Cómo demuestras que el cálculo es correcto?"

> "Con la consistencia interna: el valor constante de `hedgedPL` en la zona del piso es exactamente
> `maxLossTotalUSD`, y el de la zona del techo es exactamente `maxProfitTotalUSD`. Si la matriz y las métricas
> discrepan, hay un bug. Además el break-even de la tabla coincide con `breakevenPrice`."

### 17.10 "¿Por qué `steps=25` devuelve 26 puntos?"

> "Porque `steps` es el número de **intervalos**, y el barrido incluye ambos extremos. 25 intervalos ⇒ 26 puntos.
> El campo se llama `stepsCount` para reflejar el número real de elementos del arreglo."

### 17.11 "¿Qué valida el endpoint de recálculo?"

> "Recalcula crédito neto, piso y delta neto iterando las patas persistidas. **No** reprecía con Black-Scholes
> ni actualiza break-even o pérdida máxima; esos quedan del alta. El parámetro `currentSpotPrice` está reservado
> para la versión con reprecio. Lo digo con transparencia porque conozco el alcance real del endpoint."

### 17.12 "¿Por qué hay tres rutas para las mismas patas?"

> "Por compatibilidad de contrato v1: `/hedging` y `/hedging-strategies` son alias del mismo router, y
> `/strategies/:id/legs` monta un router hijo con `mergeParams` para conservar el `:id` del padre.
> La lógica es una sola: el mismo servicio y el mismo repositorio."

### 17.13 "¿Dónde está la evidencia de que la orden fue real?"

> "En `brokerOrderId` de cada pata. Es un campo del subdocumento que persiste el ID oficial del matching engine.
> La regla CERO SIMULACIÓN prohíbe IDs sintéticos `WB-...`; si el broker no confirma, el guardián de
> `hedging.service.js` aborta antes de llegar a mi capa de persistencia. Yo soy el libro contable de esa evidencia."

### 17.14 "¿Qué pasa si borro la estrategia?"

> "Baja lógica: `deletedAt` con timestamp y `status=CLOSED` en Mongo; todas las lecturas filtran `deletedAt: null`.
> Las patas se van con el documento porque están embebidas: la cascada es estructural. En Supabase el cierre
> es por estado, y el filtrado se hace en la consulta."

### 17.15 "¿Cómo escalaría esto si hubiera millones de estrategias?"

> "Primero índices: ya existen `{portfolioId, status}` y `{'underlying.symbol'}`. Segundo, paginación en
> `getAll` (hoy no la hay). Tercero, si el acceso dominante fuera por pata, movería `legs` a colección/tabla
> propia con índice por `strategyId`. El patrón Repository permite ese cambio sin tocar controladores."

### 17.16 "¿Qué harías diferente si lo hicieras de nuevo?"

> "Tres cosas: (1) whitelist de campos actualizables en `updateLeg` para no permitir cambiar `legId`;
> (2) reprecio real en `recalculateMetrics` usando el spot actual y Black-Scholes; (3) reconciliar los nombres
> de campos del payoff entre el spec OpenAPI y la implementación. Son mejoras identificadas, no defectos ocultos."

---

# 18. Guion de 6 minutos, minuto a minuto

**0:00 – 0:40 — Encuadre**
> "Mi nombre es Tadeo y mi vertical slice es el **ciclo de vida y la contabilidad de la cobertura**.
> Eddie estructuró el collar, Jesús calculó las primas. Yo gobierno lo que pasa después: las patas, los estados,
> las métricas y la curva de payoff."

**0:40 – 1:40 — El modelo**
Proyecta `HedgingStrategy.model.js`.
> "Todo vive en un documento. `underlying` es un subdocumento, `legs` es un arreglo de subdocumentos y
> `financialMetrics` es otro subdocumento. Las patas son composición: no existen sin su estrategia.
> Por eso las embebo y por eso la lectura es una sola query."
Señala `legRole` y sus seis valores.
> "Cada pata sabe su rol financiero: stock, piso o techo. Eso es lo que permite calcular el delta neto después."

**1:40 – 2:50 — Demo de patas**
En Scalar o Postman:
1. `GET /hedging/{id}/legs` → muestra las tres patas.
2. `POST /hedging/{id}/legs` con un call → muestra el `legId` generado en la respuesta.
3. `DELETE` de esa pata → muestra `remainingCount`.
> "El servidor normaliza la entrada: si no mando `legRole`, lo infiere del `optionType`; si no mando `legId`,
> lo genera. El cliente recibe la pata creada, no toda la estrategia."

**2:50 – 4:10 — Métricas y matemáticas**
Pizarrón con el Ejemplo A.
> "Crédito neto = prima del call menos prima del put. Break-even = S0 menos ese crédito.
> Pérdida máxima = (S0 − K_put − crédito) × acciones. Ganancia máxima = (K_call − S0 + crédito) × acciones.
> Delta neto = 1 + delta put − delta call; aquí es 0.40, o sea conservo 40 % de exposición alcista."
Menciona `PUT /financial-metrics/recalculate`.
> "Este endpoint recalcula crédito, piso y delta desde las patas. No reprecía con Black-Scholes todavía;
> eso está identificado como evolución."

**4:10 – 5:30 — Payoff**
`GET /hedging/{id}/payoff-matrix?steps=25&rangePct=0.25`.
> "Genero un barrido determinista de precios al vencimiento, de 0.75 a 1.25 del spot, en 25 intervalos.
> Para cada punto calculo la P&L sin cobertura, la P&L con collar y la diferencia, que es el valor del seguro.
> La curva tiene tres zonas: piso plano, pendiente uno a uno, techo plano. Y hay una prueba de consistencia:
> el valor plano del piso es exactamente mi pérdida máxima, y el del techo mi ganancia máxima."

**5:30 – 6:00 — Cierre y transición**
> "Todo esto funciona igual sobre MongoDB y sobre Supabase porque el patrón Repository normaliza el contrato.
> Las patas son subdocumentos en Mongo y JSONB en Postgres; el JSON que recibe el frontend es idéntico.
> Con esto cierro el ciclo de vida. Le cedo a Karime, que les va a mostrar cómo seleccionamos las empresas
> con el screener institucional."

**Plan B si el internet falla:** ten capturas de las tres respuestas (legs, metrics, payoff) y la tabla de
puntos del Ejemplo A. Dibuja la curva en el pizarrón. La demo es deseable, no indispensable.

---

# 19. Glosario

| Término | Definición |
|---|---|
| **Spot (`S0`)** | Precio actual del subyacente |
| **Strike (`K`)** | Precio de ejercicio de la opción |
| **Prima** | Precio de la opción |
| **DTE** | Days To Expiration (días para vencer) |
| **OTM / ATM / ITM** | Out-of / At / In-the-Money |
| **Collar** | Acción + put comprado + call vendido |
| **Protective Put** | Acción + put comprado |
| **Covered Call** | Acción + call vendido |
| **Break-even** | Precio de `S_T` con P&L = 0 |
| **Payoff** | P&L al vencimiento en función de `S_T` |
| **Delta neto** | Sensibilidad agregada de la posición |
| **Pata (`leg`)** | Cada componente de la estrategia |
| **Subdocumento** | Objeto anidado dentro de un documento Mongo |
| **JSONB** | Tipo binario JSON de PostgreSQL |
| **DTO** | Data Transfer Object; normaliza la forma de salida |
| **Repository** | Capa que abstrae el acceso a datos |
| **Embedding** | Guardar datos anidados en el mismo documento |
| **Baja lógica** | Marcar como borrado sin eliminar físicamente |
| **OCC** | Formato estándar de símbolo de opción (`NVDA261016P00090000`) |
| **Matching engine** | Motor que casa órdenes en el broker |

---

# 20. Checklist final

## Antes de la exposición

- [ ] Sé abrir los 6 archivos de mi slice sin buscar en el explorador.
- [ ] Sé explicar qué hace cada uno de los 25 campos de `legSchema`.
- [ ] Sé recitar las 5 fórmulas de métricas sin ver apuntes.
- [ ] Sé dibujar la curva de payoff con sus tres zonas y sus dos valores constantes.
- [ ] Sé explicar la diferencia entre Mongo (embedding) y Supabase (JSONB).
- [ ] Sé explicar el orden de precedencia de `req.dbTarget`.
- [ ] Tengo identificados los 12 puntos de discrepancia del capítulo 16.
- [ ] Probé el flujo de 7 pasos del capítulo 14 en local o en Render.
- [ ] Tengo capturas de respaldo de legs, metrics y payoff.
- [ ] Puedo explicar en una frase la diferencia entre `addLegsBatch` en `/hedging` y en `/strategies`.

## Frases que NO debes decir

| ❌ No digas | ✅ Di |
|---|---|
| "Hay un estado PENDING" | "El estado inicial es ACTIVE; el enum maneja ACTIVE, CLOSED y EXPIRED" |
| "Las patas están en la tabla `tbl_legs`" | "En Postgres están en la columna JSONB `legs_config`" |
| "El payoff va de 0.70 a 1.30 del spot" | "El rango es configurable; por defecto ±25 %" |
| "El recálculo reprecía con Black-Scholes" | "El recálculo actualiza crédito, piso y delta desde las patas" |
| "Son exactamente 25 puntos" | "Son 25 intervalos, es decir 26 puntos" |
| "La validación es con Joi" | "La validación fuerte es el schema de Mongoose; Boom cubre reglas de negocio" |
| "Es una inserción transaccional" | "Es atómica a nivel documento en Mongo" |

## La idea que el profesor debe llevarse

> "Tadeo no calcula las primas: **gobierna la posición**. Persiste las patas como composición, controla su
> ciclo de vida, convierte la posición en métricas auditables y la proyecta en una curva de payoff cuyo piso y
> techo coinciden exactamente con la pérdida y ganancia máximas. Y todo eso es idéntico en dos motores de base
> de datos distintos gracias al patrón Repository."

---

*Documento generado a partir del código real del repositorio `LSW-EQ1-PROYECTO`.
Todas las referencias de línea corresponden al estado del repositorio en la fecha de generación (2026-11-09).*
