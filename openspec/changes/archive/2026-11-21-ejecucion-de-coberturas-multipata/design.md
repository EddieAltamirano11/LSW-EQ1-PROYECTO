# Design

## Context

- **Patas en secuencia**: `createProtectivePut` envía primero las acciones y luego el Put. `autoCalibrateAndCreateCollar` tiene tres bloques casi duplicados, uno por broker. Ambos acumulan `executionErrors` y, al fallar una pata, lanzan un error sin cancelar las anteriores.
- **Verificación**: la verificación posterior del collar marca como confirmada cualquier pata con identificador, porque su estado por defecto es `submitted`. Quedan ramas `NODE_ENV !== 'test'` y `SIM-` sin uso.
- **Cantidades en Alpaca**: el Auto-Collar compra `sharesCount` acciones (por defecto, 10) y vende `ceil(sharesCount / 100)` Calls.
- **Modelo de datos**:
  - El modelo de Mongo no declara `brokerExecution`, así que Mongoose lo descarta.
  - Las patas no tienen campos de estado de orden.
  - `status` solo admite `ACTIVE`, `CLOSED` y `EXPIRED`.
  - Supabase guarda las patas en `legs_config` (JSONB).
- **Símbolo OCC**: el Protective Put y `createCollarSpread` lo guardan con el vencimiento fijo `261016`.

## Goals / Non-Goals

**Goals:**
- Ejecutar exactamente lo que se ve.
- Compensar cuando falla una pata.
- Registrar con fidelidad lo que quedó en el broker.

**Non-Goals:**
- Cerrar patas ya ejecutadas.
- Reconciliar el estado después del envío.

## Decisions

### 1. Precios y selección

- **Límites**: `ask` en compras y `bid` en ventas, cotizados de nuevo al ejecutar. Las acciones usan el `ask` del subyacente en el broker seleccionado.
  - *Alternativa descartada*: el precio medio, que baja la probabilidad de llenado en órdenes DAY.
- **Auto-Collar**: usa la selección del Core 004 (`strategyCore`), la misma del ranking.
  - Si la solicitud trae los contratos del ranking, se cotizan de nuevo y se verifica que sigan cumpliendo liquidez y costo base; si ya no cumplen, `400`.
  - Si no los trae (SPY o un activo sin evaluar), la selección se calcula en ese momento.
  - La boleta rotula la estructura como «Collar», con su costo neto.
  - *Alternativa descartada*: el objetivo de costo cero, porque ejecutaría un collar distinto al del ranking. El usuario decidió ejecutar lo que muestra la tabla.
- **Protective Put**: el `contractSymbol` de la vista previa o, si falta, el strike listado más cercano que sea menor o igual al solicitado. No hay respaldo al spot guardado en la base.

### 2. Orquestador de patas compartido

Una función recibe la lista ordenada de patas, las envía, se detiene en el primer rechazo y compensa. Reemplaza los bloques duplicados.

- **Orden**: primero el Put. Después, las acciones y el Call (Alpaca e IBKR) o la orden combinada `COVERED_STOCK` (Webull). Si falla lo siguiente, queda un Put largo con pérdida acotada, en vez de acciones sin cobertura o un Call descubierto.
- **Compensación**: consulta el estado de las patas aceptadas, cancela las que no estén ejecutadas por completo, vuelve a consultar y no cierra las ya ejecutadas.
- **Resultado**:
  - `400` sin guardar, si nada quedó vivo;
  - `409` con `PARTIALLY_EXECUTED`, si algo quedó vivo, ejecutado o con una cancelación no confirmada.
- **Estados**: se toman de la respuesta del broker o de su libro de órdenes, sin valores por defecto, con `verifiedInBroker: false` si la orden no aparece. Se eliminan las ramas `NODE_ENV` y `SIM-`.

### 3. Estado `PARTIALLY_EXECUTED` y modelo

Se usa `PARTIALLY_EXECUTED`, en inglés, como `ACTIVE`, `CLOSED` y `EXPIRED`. La interfaz lo rotula «Ejecución parcial».

*Alternativas descartadas*:
- `EJECUCION_PARCIAL`: mezclaría idiomas dentro del enum.
- No guardar nada: la base no reflejaría lo que quedó vivo en el broker, y el usuario eligió guardar.

A las patas de Mongo se agregan `orderStatus`, `filledQuantity`, `verifiedInBroker`, `brokerMessage` y `cancellation` (`{ requested, confirmed, message }`). Supabase los guarda en `legs_config` sin migración, salvo la posible restricción de `status`.

### 4. Cantidades y registro

- **Auto-Collar**: `sharesCount` múltiplo de 100 (por defecto, 100) y `contratos × 100` acciones en los tres brokers.
- **Registro**: símbolo OCC construido con el vencimiento real, e identificadores y estados del broker por pata. `/hedging/collar-spread` exige las primas.

## Risks / Trade-offs

- [El collar del ranking deja de ser apto entre la evaluación y la emisión] → `400` sin enviar órdenes, y la boleta pide volver a evaluar.
- [Una orden se llena mientras se cancela] → se guarda como `PARTIALLY_EXECUTED` lo que reporte el broker.
- [Más llamadas a los bridges] → aumentan el bloqueo de `spawnSync`, que queda fuera de alcance.

## Migration Plan

1. Si la tarea 1.1 lo exige, migrar `status` en Supabase antes de desplegar el backend.
2. Desplegar después de `ordenes-y-lecturas-fieles-al-broker` y `cadena-de-opciones-real`.
3. Rollback: revertir. Antes hay que revisar o cerrar los registros `PARTIALLY_EXECUTED`, porque el enum anterior no los acepta al guardar.

## Open Questions

- ¿Qué significa `limit_price` en una orden `COVERED_STOCK`? Se resuelve en la tarea 1.2.
- ¿Tiene `status` una restricción de valores en Supabase? Se resuelve en la tarea 1.1.
- Un tope de desviación de precio y la reconciliación posterior quedan para otro change.
