# Design

## Context

- **Tabla actual**: el ranking de `Dashboard.jsx` arma sus columnas de collar con `putFloor`, `callCeiling` y `financialMetrics` del escáner `top-collars`, que son valores teóricos de Black-Scholes. La columna «Score Cores» solo muestra el puntaje o «Veto Cores».
- **Resultado del Core 004**: la respuesta de `/strategy-screener/run` ya incluye en `cores['004'].result` el collar real:
  - `eligible`;
  - `put` y `call`, cada uno con símbolo, strike, vencimiento, `bid`, `ask`, spread, interés abierto, volumen e instante;
  - `netPremiumPerShare` (`ask` del Put − `bid` del Call);
  - `maxLoss`, `maxProfit`, `breakEven`, `underlyingPrice` y `shares`.
- **Exclusiones**: el orquestador decide el motivo de exclusión (veto, sin collar o datos incompletos), pero la respuesta solo conserva el texto; el campo interno `incomplete` se descarta.
- **Pruebas del cliente**: no hay; el cliente no tiene un runner de pruebas.

## Goals / Non-Goals

**Goals:**
- Que la tabla muestre el collar que se va a ejecutar, con su origen visible.
- Distinguir los motivos de exclusión.
- Lógica de presentación probada.

**Non-Goals:**
- Cambiar el Core 004 o el escáner.
- Agregar columnas.

## Decisions

### 1. Mapeo de fila en un módulo puro

Una función en `client/src/services/rankingCollar.js` recibe el candidato del escáner y el resultado de cores de la empresa, y devuelve qué mostrar: origen (`REAL` o `TEORICO`), contratos, costo neto normalizado, retorno y hora de cotización. `Dashboard.jsx` solo la usa para pintar.

- *Alternativa descartada*: calcularlo dentro del JSX, como hoy. No se puede probar y agranda un archivo de más de 2,000 líneas.

### 2. Normalización del costo neto

Ambos orígenes se presentan como «Débito $X» o «Crédito $X» por acción:
- en el escáner, `netDebitCredit` positivo es crédito;
- en el Core 004, `netPremiumPerShare` positivo es débito.

### 3. Retorno máximo

Para el collar real se usa `maxProfit / (underlyingPrice × shares)`. Es la misma definición del escáner (ganancia máxima sobre el valor de las acciones al spot), así que ambos orígenes son comparables.

### 4. Probabilidad en filas reales

La probabilidad N(d₂) del escáner corresponde al strike teórico, no al del Core 004. En filas reales la celda dice que no aplica y explica por qué. El ordenamiento por probabilidad sigue usando el valor teórico del escáner.

*Alternativas descartadas*:
- Recalcular N(d₂) con el strike real: requiere una volatilidad supuesta y seguiría siendo teórica.
- Mostrar la probabilidad del escáner: se referiría a otro strike.

### 5. Tipo de exclusión en el backend

`exclusionType` se asigna en `strategyScreener.service.js`, en el mismo punto donde hoy se decide el motivo.

- *Alternativa descartada*: inferirlo en el cliente a partir de los cores. Sería frágil y repetiría reglas del backend.

### 6. Vitest y React Testing Library

Se agregan al cliente con versiones exactas, entorno `jsdom` configurado en `vite.config.js` y el script `test` en `client/package.json`. Responden a la guía del profesor, que pide pruebas de componentes. Si el equipo decide no adoptarlos, la verificación de la tabla queda manual.

## Risks / Trade-offs

- [Ordenar por probabilidad con filas reales usa el valor teórico] → se explica en la celda y en el selector de orden. Tras evaluar los cores, el orden por defecto ya es el de cores.
- [Colisión con el renombre `marketPremium` → `theoreticalPremium`] → el mapeo lee el campo en un solo lugar.

## Migration Plan

1. Backend con `exclusionType`, que es aditivo y puede desplegarse primero.
2. Frontend con el mapeo y la tabla.
3. Si `escaner-sin-precios-fijos` ya se implementó, ajustar el nombre del campo de la prima teórica.

## Open Questions

- ¿Conviene calcular una probabilidad con la volatilidad implícita observada del contrato real? Se propone para otro change.
