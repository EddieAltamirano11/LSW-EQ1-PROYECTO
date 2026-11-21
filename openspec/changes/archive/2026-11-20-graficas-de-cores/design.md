# Design

## Context

- **Gráfica actual**: el TradingView del Dashboard es un iframe (`widgetembed`) que no recibe datos propios, así que no puede dibujar los niveles, tramos ni proyecciones del Core 001.
- **Sin librería de gráficas**: el cliente solo depende de React y de lucide-react.
- **Datos disponibles**:
  - Después de `core-tecnico-historico-dos-anios`, el resultado del 001 trae niveles, escalas, tramos y proyección, pero no la serie de velas.
  - El 004 trae los contratos, el costo base y las métricas.
  - El 007 trae los `drivers` con peso y puntaje.

## Goals / Non-Goals

**Goals:**
- Gráficas útiles para 001, 004 y 007.
- Bundle inicial sin cambios.
- Gráficas accesibles.

**Non-Goals:**
- Gráficas para los demás cores.
- Reemplazar TradingView.

## Decisions

### 1. `lightweight-charts` para la serie de precio

Es la librería abierta de TradingView: soporta velas, líneas de precio, marcadores y áreas, y es ligera.

| Alternativa descartada | Motivo |
|---|---|
| Widget iframe de TradingView | No acepta datos propios |
| Charting Library de TradingView | Requiere licencia |
| Recharts o Chart.js | No están pensadas para velas financieras y pesan más para este caso |

### 2. SVG propio para el payoff y la contribución

- El payoff de un collar al vencimiento es lineal por tramos y se define con 4 puntos: pérdida máxima hasta el strike del Put, una recta hasta el strike del Call y ganancia máxima después.
- La contribución son barras simples.

Ninguna de las dos justifica otra librería.

### 3. Endpoint dedicado y bajo demanda

La serie de unas 500 velas por empresa inflaría la respuesta del ranking. El endpoint reutiliza `obtenerHistorialVelas` y los cálculos del Core 001, con una caché de 90 s como la del screener.

- *Alternativa descartada*: incluir la serie en la respuesta del ranking.

### 4. Carga diferida

El componente de la gráfica técnica se importa con `import()` dinámico. Así Vite genera un chunk aparte y el bundle inicial no cambia.

### 5. Selector en la columna central

El componente de la gráfica técnica es el mismo en la columna central y en el modal. En la columna central, el encabezado de `TradingViewWidget` agrega un selector «TradingView / Core técnico».

- TradingView es la vista por defecto, y su iframe no cambia.
- La vista Core técnico pide la serie al endpoint con el símbolo seleccionado, así que no depende de haber evaluado los cores.
- La elección se conserva mientras dure la sesión.

*Alternativas descartadas*:

| Alternativa | Motivo |
|---|---|
| Reemplazar TradingView | Se perderían sus herramientas |
| Dibujar sobre el iframe | El widget gratuito no acepta datos propios, y la Charting Library requiere licencia |

### 6. Funciones puras de datos

El cálculo de los puntos del payoff y de las contribuciones, y la adaptación de niveles y tramos a la librería, viven en `client/src/services/`. Así se prueban con Vitest sin renderizar gráficas.

## Risks / Trade-offs

- [Diferencias entre la gráfica y la tabla] → ambas salen del mismo resultado, y las pruebas comparan las métricas del payoff con las del Core 004.
- [Gráficas pequeñas en móvil] → altura adaptable y resumen en texto.

## Migration Plan

1. Endpoint (aditivo).
2. Pestaña de gráficas sobre el modal existente.
3. Si algo falla, se oculta la pestaña y la tabla sigue disponible.

## Open Questions

- ¿Qué gráficas agregar después para 002, 005 y 006? Se evaluará con el uso real.
