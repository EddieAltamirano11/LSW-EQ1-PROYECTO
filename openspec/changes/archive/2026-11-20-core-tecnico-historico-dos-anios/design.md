# Design

## Context

- **Serie diaria actual**: `obtenerHistorialVelas` pide 410 días calendario para `1Day`, 35 para `1Hour` y 24 para `15Min`, y exige al menos 60 velas cerradas por marco.
- **Niveles actuales**: `zones()` en `technicalCore.js` usa los pivotes de las últimas 60 velas diarias, con tolerancia `max(0.35 × ATR, 0.2 % del precio)`, y elige los tres niveles más cercanos de cada lado sin importar su fuerza.
- **Tendencia actual**: la dirección diaria combina EMA20 y EMA50, su pendiente, ADX ≥ 20 y la estructura de máximos y mínimos. No reporta fechas.
- **Indicadores**: `momentum()` y `strength()` ya calculan el MACD y ±DI, pero solo exponen el histograma y el ADX.

## Goals / Non-Goals

**Goals:**
- Niveles y tendencias con dos años de histórico y fechas verificables.
- Una proyección honesta, con su supuesto y su precisión.
- Lectura de indicadores alineada con la guía.

**Non-Goals:**
- Cambiar el puntaje o los pesos.
- Modelos predictivos opacos.
- Ventanas intradía más largas.

## Decisions

### 1. Ventana de dos años

Se piden 730 días calendario (unas 500 sesiones) en una sola página de Alpaca (`limit` 1500).

- La SMA200 requiere 200 velas. Con menos de 220 (200 más un margen para las pendientes), las escalas primaria e intermedia se reportan como no disponibles.
- Se mantiene el mínimo de 60 velas que exige el puntaje vigente.

### 2. Niveles puntuados

Pivotes fractales con dos velas a cada lado, sobre los dos años, agrupados con la tolerancia actual. El puntaje de cada nivel pondera:

| Factor | Peso inicial |
|---|---|
| Toques | 0.40 |
| Antigüedad (decaimiento con vida media de 120 sesiones) | 0.25 |
| Volumen relativo cerca del nivel | 0.20 |
| Proximidad al precio | 0.15 |

Solo se consideran niveles dentro de ±20 % del precio. Los pesos quedan como constantes con nombre, para poder ajustarlos.

- *Alternativa descartada*: mantener la cercanía como único criterio. Con dos años aparecerían niveles débiles o irrelevantes.

### 3. Tendencias y fecha de confirmación

| Escala | Regla |
|---|---|
| Primaria | Precio sobre o bajo la SMA200, combinado con el signo de la pendiente de la SMA200 en 20 sesiones |
| Intermedia | EMA50 frente a la SMA200 |
| Corta | EMA20 frente a la EMA50, válida con ADX ≥ 20; si no, `SIDEWAYS` |

- **Fecha de confirmación**: la del cruce vigente, siempre que se haya mantenido al menos 3 sesiones. Así se filtran los cruces de ruido.
- **Tramos**: los de menos de 10 sesiones se fusionan con el tramo vecino.
- *Alternativas descartadas*: regresión segmentada o modelos de Markov ocultos. Son más difíciles de explicar y auditar, lo que va contra el principio de confluencia.

### 4. Proyección por convergencia de medias

Sea `d` la diferencia entre las dos medias de la escala:

1. Se ajusta una regresión lineal a sus últimos 20 valores.
2. Si la pendiente tiene signo contrario a `d` (las medias convergen), las sesiones hasta el cruce son `|d / pendiente|`.
3. La ventana se obtiene con el error estándar de la pendiente (±1.96σ) y se convierte a fechas con el calendario bursátil de Alpaca, que ya se consulta.
4. El horizonte máximo es de 60 sesiones; más allá se informa que no hay cambio proyectado.

- *Alternativas descartadas*: ciclos con FFT, de poco sustento, y aprendizaje automático, que sería una caja negra.

### 5. Precisión medida (walk-forward)

En cada sesión del histórico en que hubo proyección, se compara la ventana con el cruce real posterior:

- **Acierto**: el cruce real cayó dentro de la ventana.
- **Error**: diferencia en sesiones entre el cruce real y el centro de la ventana.
- **n**: número de cruces reales precedidos de una proyección.

Se reporta por empresa, con la advertencia de muestra insuficiente si `n < 3`.

### 6. Lectura de indicadores

- Se exponen la línea y la señal del MACD, y ±DI, que ya calculan `momentum()` y `strength()`.
- Se agregan la zona del RSI y la clase del ADX con los umbrales de la guía.
- La zona del RSI es una lectura informativa: no reemplaza la condición que usa el puntaje (55–75 / 25–45).

### 7. Puntaje intacto y respuesta acotada

- `technicalCore` conserva la fórmula de `bias`, `score`, `direction` y `confidence`. La ventana más larga solo cambia de forma marginal las medias exponenciales.
- La respuesta del ranking incluye los niveles (3 + 3), las escalas, los tramos resumidos y la proyección, pero no la serie de velas.

## Risks / Trade-offs

- [El volumen de IEX es parcial] → se usa volumen relativo y se declara en la limitación.
- [Muestras pequeñas para medir la precisión] → se reporta `n` y la advertencia; no se presenta una precisión sin casos.
- [La extrapolación lineal es frágil ante cambios bruscos] → el supuesto se muestra junto a la ventana, que queda fuera del puntaje.
- [Tiempo de cálculo] → unas 500 velas por empresa con cálculos lineales; impacto bajo.

## Migration Plan

1. Backend (aditivo).
2. El modal (`detalle-de-cores-en-modal`) muestra los campos nuevos en la tabla del 001, y `graficas-de-cores` los dibuja.

## Open Questions

- Los pesos del puntaje de niveles y el horizonte de 60 sesiones son valores iniciales; se pueden calibrar con la evidencia real.
