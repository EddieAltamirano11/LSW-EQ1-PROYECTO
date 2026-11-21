# Proposal

## Why

El profesor pidió mostrar cada core en gráfica y en tabla. Las tablas llegan con `detalle-de-cores-en-modal`. Este change agrega gráficas solo donde aportan información: el precio con niveles y tendencias (001), el payoff del collar (004) y la contribución de cada core al puntaje (007). El TradingView actual es un iframe y no puede dibujar los niveles que calcula el Core 001, así que el usuario eligió ver esos niveles también en la columna central, alternando con TradingView.

## What Changes

- **Serie técnica**: nuevo endpoint autenticado `GET /api/v2/strategy-screener/technical/:symbol` con la serie diaria de dos años, los niveles, los tramos y la proyección del Core 001. Es de solo lectura y usa la caché del screener.
- **Pestaña Gráfica** en la consulta de tres cores:
  - **001**: velas de dos años con bandas de soporte y resistencia, tramos de tendencia, medias y la ventana proyectada. Usa `lightweight-charts`, que se carga solo al abrir la pestaña.
  - **004**: payoff del collar al vencimiento, con strikes, breakeven, pérdida y ganancia máximas (SVG).
  - **007**: contribución de cada core al puntaje (peso efectivo × puntaje) y conflictos (SVG).
- **Selector en la columna central**: junto al título «Trading View» hay un selector «TradingView / Core técnico».
  - TradingView sigue siendo la vista por defecto y no cambia.
  - «Core técnico» muestra la gráfica del 001 para el activo seleccionado: velas de dos años, soportes y resistencias, tramos de tendencia y la ventana proyectada.
  - No requiere haber evaluado los cores.
- **Accesibilidad**: cada gráfica tiene un resumen en texto y remite a la pestaña Tabla.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `strategy-screener-api`: requisito nuevo con la serie técnica para gráficas.
- `presentacion-frontend-react`: requisitos nuevos con las gráficas de la consulta por core y con la vista técnica en la columna central.

## Impact

- **Endpoints**: nuevo `GET /api/v2/strategy-screener/technical/:symbol`.
- **Código**: rutas y servicio del screener, y componentes de gráfica nuevos en el cliente.
- **Dependencias**: `lightweight-charts` con versión exacta, cargada de forma diferida.
- **Depende de**:
  - `core-tecnico-historico-dos-anios` (los datos del 001), para el endpoint y la vista de la columna central;
  - `detalle-de-cores-en-modal` (el modal), solo para la pestaña Gráfica;
  - Vitest en el cliente, de `core-004-en-ranking`; si aún no existe, se agrega aquí.
- **Evidencia**: implementación asistida por IA, registrada en el `REPORT-DrFIC.md` del change.

## Riesgos de integración

- **Tamaño del bundle** → la librería se carga de forma diferida.
- **Consultas por empresa** → se usa la caché del screener y solo se consulta la empresa seleccionada.
- **Sin datos del 001** → la pestaña muestra la causa, en lugar de una gráfica vacía o con datos supuestos.

## Plan de validación y rollback

- **Validación**:
  - pruebas del endpoint (contrato, `401`, `400` y `503`);
  - pruebas de las funciones de payoff y de contribución, y pruebas de componente;
  - build, revisando que la librería quede en un chunk aparte;
  - revisión manual.
- **Rollback**: revertir; el endpoint es nuevo y la pestaña desaparece.

## No-objetivos

- Gráficas de 002, 005 y 006, que se evaluarán después. El 003 no necesita gráfica.
- Reemplazar el widget de TradingView.
