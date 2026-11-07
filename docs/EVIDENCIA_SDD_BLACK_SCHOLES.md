# Evidencia SDD: validación de Black-Scholes

## Identificación y atribución

| Elemento | Registro |
| --- | --- |
| Endpoint | `POST <API_URL>/quant/black-scholes` |
| Cambio OpenSpec | `validar-entrada-black-scholes` |
| Referencia previa | `abcae86f2b0ce28ee84a06224a01e888333e0204` |
| Implementación de esta mejora | Asistida por IA: Codex, siguiendo las especificaciones OpenSpec |
| Autoría de la implementación original | No determinada por esta revisión; conservar la referencia Git sin atribuirla a IA o trabajo manual |
| Optimización manual | Pendiente de realizar y acreditar por el equipo; esta mejora de Codex no cuenta como manual |

Este registro acredita el uso de SDD para mejorar un endpoint existente. La comparación siguiente corresponde al código previo y a esta mejora asistida por IA; la comparación IA/manual de la actividad requerirá incorporar una intervención manual real con responsable, diferencia de código y resultados.

## Artefactos previos a la implementación

El cambio se creó mediante `openspec new change validar-entrada-black-scholes`. Después se generaron, en orden, [propuesta](../openspec/changes/validar-entrada-black-scholes/proposal.md), [especificación](../openspec/changes/validar-entrada-black-scholes/specs/validacion-black-scholes/spec.md), [diseño](../openspec/changes/validar-entrada-black-scholes/design.md) y [tareas](../openspec/changes/validar-entrada-black-scholes/tasks.md), consultando `openspec instructions` antes de cada artefacto. Se consultaron las instrucciones de `apply` antes de modificar la aplicación.

[La constitución](../openspec/config.yaml) define las reglas de estructura, compatibilidad y atribución. La especificación permite proponer una estructura propia si la actual no resulta adecuada; el diseño compara alternativas antes de elegir la extensión mínima.

## Estructura antes y después

Antes:

```text
Ruta HTTP --> Controlador --> Servicio cuantitativo compartido
                              Conversión de tipos y cálculo
```

Después:

```text
Ruta HTTP --> Controlador --> Validador de entrada
                         --> Servicio cuantitativo compartido
                         --> Comprobación de resultado finito
                         --> Respuesta HTTP o error 400
```

Se mantiene la organización existente y se añade un módulo específico en `src/api/v1/validators/black-scholes.validator.js`. Esto separa el contrato HTTP de las fórmulas que también usan volatilidad implícita y coberturas. El servicio compartido no se modifica. No se añaden dependencias ni migraciones.

## Comparación observable

La entrada de referencia es `{"spotPrice":100,"strikePrice":100,"timeToExpirationYears":1}`. Los casos originales se ejecutaron antes de modificar el controlador, mediante un servidor HTTP local que importa `src/app.js`.

| Caso | Antes | Después (verificado) |
| --- | --- | --- |
| PUT con valores predeterminados | `200`, precio `5.7858` | Mismo cuerpo y resultado |
| CALL con tasa `0.05` y volatilidad `0.2` | `200`, precio `10.4506` | Mismo cuerpo y resultado |
| Cadenas numéricas y `optionType: "put"` | `200`, números normalizados y `PUT` | Misma compatibilidad |
| Objeto vacío | `200` con precio y griegas `null` | `400` identificando `spotPrice` |
| `spotPrice: "abc"` | `200` con resultados `null` | `400` identificando `spotPrice` |
| `optionType: null` | `500` por excepción de tipo | `400` identificando `optionType` |
| Tasa `-1e308` | El servicio produce resultados no finitos que JSON representa como `null` | `400` por rango numérico |

Se conservan `volatility: 0.2`, `riskFreeRate: 0.045` y `optionType: "PUT"` cuando se omiten; las tasas cero o negativas finitas siguen admitidas cuando producen resultados representables. Las cadenas numéricas no vacías conservan la conversión compatible. Los campos adicionales no modifican el cálculo.

## Verificación reproducible

Desde la raíz del repositorio:

```powershell
node --test test/black-scholes.validation.test.js
npm test
openspec validate validar-entrada-black-scholes --strict
git diff abcae86f2b0ce28ee84a06224a01e888333e0204 -- src/api/v1/services/quant.service.js
```

Las pruebas usan un puerto local efímero, sin iniciar `src/index.js`, abrir conexiones a bases ni realizar operaciones con brokers. Incluyen respuestas de referencia literales, datos inválidos, desbordamiento, prefijo alternativo, publicación de OpenAPI y una solicitud de volatilidad implícita. La suite existente comprueba el login y los contratos de sesión. El último comando debe producir una diferencia vacía para las fórmulas compartidas.

### Sincronización de Postman

```powershell
python scripts/build_full_postman_collection.py --black-scholes-only
```

Se requiere Python 3. En esta máquina se utilizó el intérprete incluido en el runtime de Codex porque el comando `python` del sistema apunta al acceso de Microsoft Store sin un intérprete instalado.

El modo acotado toma el cuerpo de `request/test_api.http` y actualiza únicamente la petición Black-Scholes en `LSW_Cloudflare_Postman_Collection.json` y `LSW_Render_Postman_Collection.json`. Añade la descripción del contrato y aserciones Postman de estado `200`, CALL/PUT y precio/griegas finitos. No ejecuta las peticiones ni escribe las copias externas del generador completo. Se comprobó la igualdad semántica del resto de las colecciones con la referencia Git y la idempotencia de una segunda ejecución.

### Resultados de esta ejecución

- Antes de modificar el controlador: las 22 pruebas nuevas registraron 5 casos aprobados y 17 fallos que evidencian los defectos y el contrato todavía no documentado.
- Después de implementar: las 22 pruebas nuevas pasan, con coincidencia exacta de los cuerpos PUT/CALL de referencia.
- Suite completa local: 33 pruebas descubiertas, 32 aprobadas y 1 fallo preexistente en `test/login.session.test.js:21`.
- El fallo preexistente espera `x-active-database: mongodb` en un login con Supabase. Tanto el middleware de la referencia `abcae86` como el actual producen `supabase`, porque ya consideran `databaseTarget` del cuerpo. Se reprodujo la prueba aislada y se comparó el middleware anterior con el actual; autenticación, middleware y prueba no se modificaron en este cambio.
- Verificación HTTP complementaria de login y sesión para MongoDB y Supabase: aprobada, comprobando el encabezado actual y la selección de base del JWT sin sobrescribirla.
- `openspec validate validar-entrada-black-scholes --strict`: aprobado.
- Regeneración acotada de Postman: aprobada, idempotente y con el resto de peticiones intactas.
- Verificación final de alcance y fórmulas: diferencia vacía en `quant.service.js`, con SHA-256 `64581694A0A37A39CD1D78170D3666CD46D6A5EDBC12C0B77638525B0A3C505F` antes y después; el diff se limita a esta mejora y sus artefactos, pruebas y documentación.

Las nueve tareas del cambio quedan implementadas y verificadas, con el fallo previo de la suite documentado. El cambio permanece activo, sin archivar y sin commit ni push.

## Registro para una optimización manual posterior

Cuando el equipo realice una intervención manual, añadir: nombre del responsable, endpoint y especificación utilizados, referencia de la versión asistida por IA, archivos y diferencia manual, motivo técnico y pruebas con resultados antes/después. Si se emplea IA también en esa intervención, registrarla como asistida por IA.
