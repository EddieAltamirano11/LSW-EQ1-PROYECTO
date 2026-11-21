# Proposal

## Why

El profesor pidió que el Core 001 ("técnico es indicadores") calcule soportes, resistencias y tendencias con dos años de histórico, y que diga cuándo se proyecta una tendencia alcista o bajista. Hoy la serie diaria cubre unos 13 meses, los niveles salen solo de las últimas 60 velas y se eligen por cercanía aunque sean débiles, y no hay fechas de tendencia. Se acordó con el profesor reportar la fecha en que se confirmó cada tendencia y una ventana proyectada con su precisión medida, en lugar de un día exacto.

## What Changes

- **Dos años de histórico diario**: velas cerradas y ajustadas por split. Las series de 1H y 15m no cambian.
- **Niveles puntuados**: soportes y resistencias de los dos años, agrupados por tolerancia de ATR y puntuados por toques, antigüedad, volumen cercano y distancia al precio. Se reportan los tres más fuertes de cada lado, con toques, fecha del último toque y distancia.
- **Tendencias con fechas**, en tres escalas, cada una con su dirección y fecha de confirmación, más los tramos históricos de los dos años:
  - primaria: precio frente a la SMA200;
  - intermedia: EMA50 frente a la SMA200;
  - corta: EMA20 frente a la EMA50, con filtro de ADX.
- **Proyección** en las escalas intermedia y corta:
  - si las medias convergen, la ventana de fechas en que se cruzarían si se mantiene la pendiente reciente;
  - si no convergen, la indicación de que no hay cambio proyectado en el horizonte;
  - la precisión medida sobre el propio histórico: aciertos de la ventana, error medio y número de casos.
- **Lectura de indicadores** con los parámetros de la guía: zona del RSI(14); línea, señal, histograma y último cruce del MACD(12,26,9); ADX(14) con +DI, −DI y clase de fuerza; bandas y ancho de Bollinger(20,2).
- **Puntaje sin cambios**: el puntaje, la dirección y la confianza del Core 001 conservan su fórmula. La proyección es informativa y no entra al puntaje.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `strategy-screener-api`: requisitos nuevos del Core 001 (niveles y tendencias de dos años, proyección con precisión medida y lectura de indicadores).

## Impact

- **Endpoints**: `POST /api/v2/strategy-screener/run` agrega campos al resultado del Core 001. Es aditivo.
- **Código**: `marketData.js` (ventana diaria) y `technicalCore.js`, con pruebas basadas en series de prueba versionadas.
- **Datos**: una consulta diaria por empresa, con unas 500 velas en una sola página de Alpaca.
- **Evidencia**: implementación asistida por IA, registrada en el `REPORT-DrFIC.md` del change.

## Riesgos de integración

- **Volumen de IEX**: es una fracción del volumen consolidado → se usa volumen relativo y se declara en la limitación del core.
- **Pocos cruces en dos años**: la precisión puede medirse con 0 a 3 casos → se reporta el número de casos y se advierte cuando la muestra es insuficiente.
- **Tamaño de la respuesta**: se limitan los niveles a tres por lado y los tramos a un resumen. La serie completa para las gráficas va en otro endpoint (`graficas-de-cores`).

## Plan de validación y rollback

- **Validación**: pruebas deterministas con series de prueba versionadas (tendencias, cruces y niveles conocidos), `npm test` y verificación con datos reales registrada en la evidencia.
- **Rollback**: revertir; los campos son aditivos.

## No-objetivos

- Cambiar los pesos de la confluencia o la fórmula de puntaje del Core 001.
- Predecir el día exacto de un cambio de tendencia.
- Ampliar las ventanas intradía.
