# strategy-screener-api Specification

## Purpose
API del escáner por cores (`/api/v2/strategy-screener`): evalúa empresas para Collar Spread con los cores 001 a 007 usando solo observaciones reales (Alpaca, SEC EDGAR y Webull), informa la participación de cada core y el tipo de exclusión de cada empresa, y entrega la serie técnica del Core 001 para las gráficas.

## Requirements

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

### Requirement: Participación de cada core en el resultado

Para cada empresa, cada core SHALL informar su `role`:

| `role` | Significado |
|---|---|
| `CONFLUENCE` | El core está seleccionado y su puntaje entra a la confluencia |
| `GATE` | Se calculó como filtro de elegibilidad, sin ponderar: Fundamental cuando no está seleccionado (veto de viabilidad) y Estrategia `004` |
| `DEPENDENCY` | Se calculó solo porque lo requiere otro core seleccionado, como Técnico cuando únicamente está seleccionado Señales directas |
| `SYNTHESIS` | Confluencia `007` |
| `NOT_COMPUTED` | No se calculó |

Con `role: CONFLUENCE`, el core SHALL incluir `effectiveWeight` igual al peso normalizado que aplicó la confluencia.

#### Scenario: Core seleccionado
- **GIVEN** están seleccionados los cores 001, 002, 003, 005 y 006
- **WHEN** se evalúa una empresa
- **THEN** el core 001 tiene `role: CONFLUENCE` y `effectiveWeight: 0.225`

#### Scenario: Técnico como dependencia
- **GIVEN** solo está seleccionado el core 003
- **WHEN** se evalúa una empresa
- **THEN** el core 001 tiene `role: DEPENDENCY` y no incluye `effectiveWeight`

#### Scenario: Fundamental como filtro
- **GIVEN** el core 002 no está seleccionado
- **WHEN** se evalúa una empresa
- **THEN** el core 002 tiene `role: GATE`

#### Scenario: Core no calculado
- **GIVEN** el core 005 no está seleccionado
- **WHEN** se evalúa una empresa
- **THEN** el core 005 tiene `role: NOT_COMPUTED`

### Requirement: Serie técnica para gráficas

`GET /api/v2/strategy-screener/technical/:symbol` SHALL requerir sesión y SHALL devolver, para el símbolo:

- las velas diarias cerradas de los dos años que usa el Core 001;
- sus niveles de soporte y resistencia, los tramos de tendencia, las medias móviles y la proyección vigente;
- la fuente y el instante de corte.

SHALL ser de solo lectura y responder así en los casos de error:

| Situación | Respuesta |
|---|---|
| Sin sesión válida | `401` |
| Símbolo inválido | `400` |
| La fuente no entrega datos | `503` con la causa, sin datos supuestos |

#### Scenario: Serie de una empresa
- **GIVEN** una sesión válida
- **WHEN** se consulta la serie técnica de AAPL
- **THEN** la respuesta incluye las velas diarias de dos años con los niveles, tramos, medias y proyección del Core 001, su fuente y su instante de corte

#### Scenario: Sin sesión
- **WHEN** se consulta la serie técnica sin token
- **THEN** la API responde `401`

#### Scenario: Fuente sin datos
- **WHEN** Alpaca no entrega las velas del símbolo
- **THEN** la API responde `503` con la causa

### Requirement: Tipo de exclusión por empresa

Cada empresa en `excluded` SHALL incluir, además de su motivo, `exclusionType` con uno de estos valores:

| Valor | Cuándo |
|---|---|
| `VIABILITY_VETO` | La empresa quedó clasificada como `MARGINAL` o `NO_VIABLE` |
| `NO_COLLAR` | El Core 004 no encontró un par Put/Call líquido y compatible |
| `INSUFFICIENT_DATA` | Faltaron datos de la elegibilidad, de la cadena o de un core seleccionado |

#### Scenario: Veto de viabilidad
- **GIVEN** una empresa clasificada como `MARGINAL`
- **WHEN** se evalúan los cores
- **THEN** la empresa aparece en `excluded` con `exclusionType: VIABILITY_VETO` y su motivo

#### Scenario: Sin collar líquido
- **GIVEN** una empresa viable sin un par Put/Call apto
- **WHEN** se evalúan los cores
- **THEN** la empresa aparece en `excluded` con `exclusionType: NO_COLLAR`

#### Scenario: Datos insuficientes
- **GIVEN** una empresa a la que le falta el puntaje de un core seleccionado
- **WHEN** se evalúan los cores
- **THEN** la empresa aparece en `excluded` con `exclusionType: INSUFFICIENT_DATA`

### Requirement: Riesgo de eventos sin verificar

Cuando el calendario de resultados no responda o no entregue una fecha utilizable, la API SHALL NOT estimar ni inventar una fecha, ni atribuir evidencia al proveedor. En su lugar:

- SHALL informar el riesgo de eventos como `UNVERIFIED`, con la causa y la fuente consultada.
- La falta de fecha SHALL NOT retirar la posición del activo cuando la elegibilidad y los cores seleccionados tengan datos suficientes.
- Fundamental (`002`) SHALL calcular su puntaje sin el componente de eventos e indicar que el riesgo no está verificado.
- Señales directas (`003`) SHALL abstenerse con la señal `HOLD` y la regla `EVENT_UNVERIFIED`.
- El activo y la respuesta SHALL marcarse como parciales.

#### Scenario: Calendario indisponible para un activo
- **WHEN** Webull no responde a la consulta del calendario de resultados de AAPL y el resto de sus datos está disponible
- **THEN** AAPL conserva su posición, su riesgo de eventos es `UNVERIFIED` con la causa, `003` devuelve `HOLD` con `EVENT_UNVERIFIED` y la respuesta es `200` con estado parcial

#### Scenario: Calendario con fecha verificable
- **WHEN** el calendario entrega una fecha de resultados dentro de la ventana válida
- **THEN** el riesgo se clasifica como `HIGH`, `MEDIUM` o `LOW`, con la evidencia de esa fuente

#### Scenario: Sin fechas estimadas
- **WHEN** el calendario falla
- **THEN** la respuesta no contiene fechas de resultados ni evidencia atribuida al calendario
