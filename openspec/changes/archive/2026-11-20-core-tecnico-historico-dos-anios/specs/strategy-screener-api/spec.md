# Spec Delta

## ADDED Requirements

### Requirement: Niveles y tendencias del Core 001 con dos años de histórico

El Core 001 SHALL calcular soportes, resistencias y tendencias con las velas diarias cerradas de los últimos dos años.

- **Niveles**: SHALL reportar hasta tres soportes y tres resistencias, elegidos por un puntaje que considere toques, antigüedad, volumen cercano y distancia al precio. Cada nivel SHALL incluir precio, toques, fecha del último toque, puntaje y distancia porcentual al precio.
- **Tendencias**: SHALL reportar la tendencia en tres escalas (primaria, intermedia y corta), cada una con su dirección (`UP`, `DOWN` o `SIDEWAYS`) y la fecha en que se confirmó.
- **Tramos**: SHALL reportar los tramos de tendencia de los dos años, con dirección y fechas de inicio y fin.
- Si no hay velas suficientes para una escala, SHALL informarla como no disponible con la causa, sin valores supuestos.

#### Scenario: Tendencia vigente con fecha de confirmación
- **GIVEN** una serie de prueba en la que la EMA50 cruzó al alza la SMA200 el 2026-08-14 y se mantuvo arriba
- **WHEN** se calcula el Core 001
- **THEN** la tendencia intermedia es `UP` con fecha de confirmación 2026-08-14

#### Scenario: Niveles elegidos por puntaje
- **GIVEN** un soporte tocado cuatro veces y otro más cercano al precio tocado una sola vez
- **WHEN** se calculan los niveles
- **THEN** el soporte de cuatro toques tiene mayor puntaje y aparece primero

#### Scenario: Historial insuficiente
- **WHEN** hay menos velas diarias que las necesarias para la SMA200
- **THEN** las escalas primaria e intermedia se informan como no disponibles, con la causa

### Requirement: Proyección de cambio de tendencia con precisión medida

En las escalas intermedia y corta, cuando las medias que definen la tendencia converjan, el Core 001 SHALL reportar la ventana de fechas en que se cruzarían si se mantiene su pendiente reciente, junto con el supuesto aplicado. Si no convergen, o si el cruce queda fuera del horizonte configurado, SHALL indicar que no hay cambio proyectado.

- Cada proyección SHALL incluir la precisión medida sobre el propio histórico: proporción de cruces que cayeron dentro de la ventana proyectada, error medio en sesiones y número de casos.
- La proyección SHALL NOT expresarse como un día exacto.
- La proyección SHALL NOT entrar al puntaje del Core 001 ni a la confluencia.

#### Scenario: Medias que convergen
- **GIVEN** una serie de prueba en la que la EMA20 baja hacia la EMA50 con pendiente constante
- **WHEN** se calcula el Core 001
- **THEN** la escala corta informa una ventana de fechas de cruce bajista, con el supuesto aplicado y la precisión medida

#### Scenario: Medias que se separan
- **WHEN** las medias de una escala se alejan entre sí
- **THEN** esa escala indica que no hay cambio proyectado en el horizonte

#### Scenario: Muestra insuficiente para medir la precisión
- **WHEN** el histórico tiene menos de tres cruces con los que medir la precisión
- **THEN** la precisión se reporta con su número de casos y la advertencia de muestra insuficiente

#### Scenario: Proyección fuera del puntaje
- **WHEN** se calcula el puntaje del Core 001
- **THEN** se obtiene con la fórmula vigente, sin usar la ventana proyectada

### Requirement: Lectura de indicadores técnicos

En el marco diario, el Core 001 SHALL reportar la lectura de sus indicadores con estos parámetros:

| Indicador | Lectura |
|---|---|
| RSI(14) | Valor y zona: `OVERSOLD` (< 30), `NEUTRAL` u `OVERBOUGHT` (> 70) |
| MACD(12,26,9) | Línea, señal, histograma, y tipo y fecha de su último cruce |
| ADX(14) | ADX, +DI, −DI y clase: `NO_TREND` (< 20), `WEAK` (20–25), `STRONG` (25–50) o `VERY_STRONG` (≥ 50) |
| Bollinger(20, 2) | Bandas superior, media e inferior, y ancho relativo |

#### Scenario: RSI sobrecomprado
- **GIVEN** una serie de prueba con RSI(14) de 74
- **WHEN** se calcula el Core 001
- **THEN** la zona del RSI es `OVERBOUGHT`

#### Scenario: Tendencia fuerte según el ADX
- **GIVEN** una serie de prueba con ADX(14) de 31
- **WHEN** se calcula el Core 001
- **THEN** la clase del ADX es `STRONG` y se informan +DI y −DI
