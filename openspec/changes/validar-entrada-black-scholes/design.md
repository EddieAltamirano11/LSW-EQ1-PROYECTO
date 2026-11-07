# Design

## Context

Ver `proposal.md` para la motivación y `specs/validacion-black-scholes/spec.md` para el contrato. La referencia previa es `abcae86f2b0ce28ee84a06224a01e888333e0204`.

La ruta cuantitativa delega en `quant.controller.js`, que envía directamente `req.body` a `quant.service.js`. El servicio convierte números mediante `Number`, normaliza `optionType` y calcula precio y griegas. También lo consumen volatilidad implícita, métricas de estrategias y coberturas. El manejador global ya transforma errores Boom en JSON.

La prueba HTTP previa confirmó `200` con resultados `null` para `{}` y `spotPrice: "abc"`, y `500` para `optionType: null`. Una tasa `-1e308`, finita pero fuera de la capacidad del cálculo, también genera resultados no finitos. Las respuestas de referencia para un PUT predeterminado y un CALL explícito se capturan para pruebas de compatibilidad.

## Goals / Non-Goals

**Goals:**

- Aislar el contrato HTTP del cálculo compartido y comprobar la compatibilidad con respuestas previas concretas.
- Hacer visible el proceso SDD y la atribución del trabajo sin atribuir retrospectivamente la autoría del código anterior.

**Non-Goals:**

- Modificar fórmulas, algoritmos, modelos, autenticación, infraestructura o reglas globales de contexto.
- Afirmar una optimización manual inexistente ni ejecutar pruebas contra servicios financieros externos.

## Decisions

### 1. Validador específico llamado desde el controlador

Crear `src/api/v1/validators/black-scholes.validator.js`, con validación del objeto y normalización de sus seis parámetros conocidos. El controlador pasa el resultado al servicio sin alterar sus fórmulas. Tras el cálculo, el módulo comprueba que el precio y las cinco griegas sean finitos; si no lo son emite `400`. Los campos adicionales se toleran, incluyendo los añadidos por los middlewares de contexto.

La estructura actual de rutas/controladores/servicios es adecuada. Se extiende con un módulo pequeño de validación en la frontera HTTP. Si una estructura actual no es óptima para una mejora futura, las reglas de configuración y la especificación permiten proponer otra dentro del alcance, justificándola en el diseño.

Alternativas: validar dentro de `quant.service.js` afectaría a consumidores internos; incorporar una librería de esquemas añadiría una dependencia para seis campos; añadir un middleware de ruta y propiedades nuevas a `req` introduciría una capa adicional innecesaria para este endpoint.

### 2. Compatibilidad de entrada

Aceptar números finitos y cadenas no vacías convertibles mediante `Number`, rechazando explícitamente booleanos, objetos, arreglos y nulos. Requerir positividad en precios, tiempo y volatilidad. Admitir tasas finitas de cualquier signo. Omitir los valores opcionales no recibidos para que el servicio siga aplicando sus propios valores predeterminados. Normalizar CALL/PUT con `toUpperCase` después de comprobar el tipo. Usar `boom.badRequest` y el formato de error existente.

Alternativa: aceptar únicamente números JSON sería más estricto que el comportamiento actual y podría romper clientes que envían cadenas numéricas.

### 3. OpenAPI y colecciones Postman dentro del alcance

Actualizar únicamente el contrato Black-Scholes, documentando valores predeterminados, entradas compatibles y error `400`. El generador Postman actual usa rutas absolutas de otra máquina y escribe copias externas al repositorio. Añadir un modo `--black-scholes-only` que resuelva la raíz desde el propio script, reutilice el parser de `request/test_api.http` y sincronice solo la petición Black-Scholes en las dos colecciones locales, con descripción y comprobaciones de respuesta finita. Conservar intacto el resto de solicitudes y comprobar la idempotencia del modo.

### 4. Constitución y evidencia

Completar `openspec/config.yaml` con el contexto tecnológico y reglas por artefacto sobre evaluación de estructura, escenarios, compatibilidad y registro IA/manual. Documentar en `docs/EVIDENCIA_SDD_BLACK_SCHOLES.md` la referencia previa, la estructura antes/después, los defectos reproducidos, la implementación asistida por Codex y los resultados de verificación. Registrar la optimización manual como pendiente de realizar y acreditar por el equipo. Enlazar la evidencia desde el README.

### 5. Verificación local

Crear pruebas HTTP con `node:test` que importen `src/app.js`, usen un puerto efímero local y no ejecuten `src/index.js`. Comprobar los escenarios de la especificación, respuestas de referencia literales, prefijo alternativo, un flujo de volatilidad implícita sin cambios y la suite de sesión existente. Comparar `quant.service.js` con Git para asegurar que sus fórmulas no cambiaron.

## Risks / Trade-offs

- Clientes que dependan de aceptar datos inválidos verán `400` en lugar de `200`/`500` → documentar los casos y conservar entradas válidas, valores predeterminados y formato exitoso.
- Convertir cadenas como números puede aceptar más formatos que los ejemplos JSON → describir la compatibilidad de conversión y probarla sin coerción de otros tipos.
- Algunos valores finitos producen desbordamiento → comprobar la finitud de la salida únicamente en este endpoint.
- Una regeneración completa de Postman alteraría flujos ajenos → usar exclusivamente el modo acotado y comparar semánticamente las otras solicitudes.
- El entorno restringe las conexiones a localhost → ejecutar las verificaciones HTTP con el permiso de ejecución necesario y sin llamadas externas.

## Migration Plan

No se requieren migraciones ni dependencias. Ejecutar las pruebas y la validación OpenSpec antes de integrar el cambio. Una reversión puede retirar la llamada al validador y sus archivos/documentación asociados sin afectar datos persistidos. El cambio se deja implementado y sin archivar para su revisión; no se crean commits ni se publica.
