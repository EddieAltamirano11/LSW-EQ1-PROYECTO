# Design

## Context

- **Respaldo fijo**: `getCachedOrBrokerSpot` devuelve el `referenceSpot` fijo si el broker falla o tarda más de 600 ms, y siempre en `NODE_ENV === 'test'`. Las pruebas del escáner dependen de esa rama.
- **Tickers añadidos**: si no tienen cotización, reciben precio 100 y volatilidad 0.28.
- **Canasta**: `MARKET_BASKET` guarda `referenceSpot`, `rsi14`, `aboveSma200`, `beta`, `dividendYield` y `baseVolatility`. Con el RSI y la SMA fijos se arman `technicalOutlook` y `technicalSummary`, que el cliente no usa.
- **Prima "de mercado"**: `marketPremium` es Black-Scholes × 1.02 en el Put y × 0.98 en el Call. El cliente la muestra en el ranking, la boleta y el modal.

## Goals / Non-Goals

**Goals:**
- Ningún precio fijo ni dato técnico inventado.
- Valores teóricos identificados como tales.

**Non-Goals:**
- Diagnóstico técnico en el escáner.
- Cambiar las fórmulas.

## Decisions

### 1. Proveedor de cotizaciones inyectable

`scanTopCollars` recibe el proveedor de cotizaciones, que por defecto es `getBrokerQuote`. Las pruebas inyectan uno de prueba, lo que permite eliminar la rama `NODE_ENV === 'test'`. La caché de 60 s guarda solo cotizaciones válidas.

### 2. Activos no disponibles

Un activo sin cotización válida va a `unavailable` con su motivo. Si no queda ningún activo cotizado, se responde `503`.

- *Alternativa descartada*: mantener el precio de referencia con una etiqueta. Seguiría mostrando datos de mercado inventados.

### 3. Campos teóricos

`marketPremium` pasa a ser `theoreticalPremium`, y se agrega `pricing` con el modelo, la volatilidad supuesta y la tasa. El origen de la volatilidad es el valor de cada activo en la canasta o, para los tickers añadidos, un valor declarado.

- *Alternativa descartada*: conservar `marketPremium` con una etiqueta. El nombre seguiría afirmando que es un precio de mercado.

### 4. Datos fijos retirados

Se eliminan `referenceSpot`, `rsi14`, `aboveSma200`, `technicalSummary` y `technicalOutlook`. `beta`, `dividendYield` y `baseVolatility` se quedan como datos de referencia del modelo.

## Risks / Trade-offs

- [Cambio de campos para consumidores externos, como Postman] → se documenta como BREAKING en OpenAPI y en Postman.

## Migration Plan

1. Archivar antes `v2-screener-tradingview`.
2. Desplegar backend y frontend en el mismo commit.

## Open Questions

Ninguna que cambie el alcance.
