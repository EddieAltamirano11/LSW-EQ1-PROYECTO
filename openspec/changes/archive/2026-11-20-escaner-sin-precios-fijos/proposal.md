# Proposal

## Why

Si el broker falla o tarda más de 600 ms, `top-collars` usa en silencio un precio de referencia fijo (por ejemplo, AAPL a $227.50), y para los tickers añadidos usa $100. Además, presenta como "prima de mercado" un valor de Black-Scholes y calcula `technicalOutlook` con RSI y SMA200 fijos guardados en el código.

## What Changes

- **Sin precios fijos**: los activos sin cotización válida se omiten del ranking y se listan en `unavailable` con el motivo; si ninguno tiene cotización, se responde `503`. Los tickers añadidos sin cotización también van a `unavailable`.
- **Valores teóricos identificados**: **BREAKING** `marketPremium` pasa a llamarse `theoreticalPremium`, y se agrega `pricing` con el modelo, la volatilidad supuesta (con su origen) y la tasa. El panel rotula estos valores como teóricos en el ranking, la boleta y el modal.
- **BREAKING**: se retiran `technicalOutlook` y los datos fijos de la canasta (`referenceSpot`, `rsi14`, `aboveSma200` y `technicalSummary`).
- La reescritura del requisito incorpora `limit` hasta 25, `sortBy=cores` y `extraSymbols`, que ya existen en el código.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `screener-v2`: `top-collars` sin precios fijos, con las primas teóricas identificadas y sin `technicalOutlook`.
- `presentacion-frontend-react`: requisito nuevo para identificar los valores teóricos del escáner.

## Impact

- **Endpoints**: `GET /api/v2/market/scanner/top-collars` y su alias.
- **Compatibilidad**: cambios **BREAKING** en los campos. El único consumidor interno es el panel, que se actualiza en este mismo change.
- **Código**:
  - backend: `scanner.service.js` y `test/scanner.v2.test.js`;
  - cliente: `Dashboard.jsx`, `BrokerExecutionModal.jsx` y el módulo de mapeo de `core-004-en-ranking`, si ya existe.
- **Archivo**: antes de archivar este change hay que archivar `v2-screener-tradingview`, que es la base del requisito modificado.
- **Evidencia**: implementación asistida por IA, registrada en el `REPORT-DrFIC.md` del change.

## Riesgos de integración

- **Renombre del campo en el cliente** → backend y frontend van en el mismo commit.
- **Más activos ausentes si el broker es lento** → aparecen en `unavailable` con su motivo.

## Plan de validación y rollback

- **Validación**: pruebas del escáner con un proveedor de cotizaciones de prueba, build del cliente y revisión del ranking, la boleta y el modal.
- **Rollback**: revertir el backend y el frontend juntos.

## No-objetivos

- Calcular un diagnóstico técnico real en el escáner; eso le corresponde al Core 001.
- Cambiar las fórmulas de Black-Scholes.
