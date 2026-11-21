# Proposal

## Why

El Protective Put y el Auto-Collar envían patas reales con datos inventados y sin compensación. Si una pata falla después de que otra fue aceptada, responden "no se registró nada" y dejan la anterior viva en el broker sin mencionarla. Además:

- la "verificación en vivo" del collar se aprueba sola, porque cada pata trae `submitted` por defecto;
- el Auto-Collar en Alpaca puede dejar un Call descubierto con `sharesCount: 10`;
- las estrategias guardadas usan un vencimiento fijo (`261016`) en el símbolo OCC.

## What Changes

- **Precios de las patas** tomados de cotizaciones observadas al ejecutar: `ask` en compras y `bid` en ventas. Ya no se usan como límite el `putPremium` ni el `spotPrice` del cliente, ni el spot guardado en la base.
- **Auto-Collar con el collar del ranking**: usa el par que selecciona el Core 004 (el de la tabla), cotizado de nuevo. Si ya no es apto, responde `400` sin enviar órdenes. Si el activo no tiene resultado del Core 004, la selección se calcula en ese momento. Se abandona el criterio de costo cero, y el Auto-Collar sigue en la columna derecha.
- **Protective Put** con el contrato de `contractSymbol` o, si falta, el strike listado más cercano que sea menor o igual al solicitado.
- **Orden de envío y compensación**:
  - primero se envía el Put;
  - si una pata falla, se cancelan las pendientes y no se cierran las ya ejecutadas;
  - si algo quedó vivo, la estrategia se guarda como `PARTIALLY_EXECUTED` con el estado real de cada orden y se responde `409`;
  - si no quedó nada, se responde `400` sin guardar.
- **Estados honestos**: cada pata lleva el estado que reporta el broker; las que no aparecen en su libro de órdenes se informan como no verificadas.
- **Cantidades**: el Auto-Collar exige `sharesCount` múltiplo de 100 (por defecto, 100) y compra `contratos × 100` acciones en todos los brokers.
- **Registro fiel**: símbolos OCC con el vencimiento real, e identificadores y estados del broker por pata. `/hedging/collar-spread` exige las primas.

## Capabilities

### New Capabilities

- `coberturas-cotizaciones-reales`: requisitos de precios de las patas, compensación, estados, cantidades y registro. Comparte la capability con `cadena-de-opciones-real`, que agrega los de cadena y vista previa.

### Modified Capabilities

Ninguna.

## Impact

- **Endpoints**: `POST /api/v1|v2/hedging/auto-collar`, `/protective-put` y `/collar-spread`.
- **Compatibilidad**:
  - nuevo `409` para la ejecución parcial;
  - `400` cuando el collar del ranking ya no es apto o la cantidad es inválida;
  - el Protective Put acepta `contractSymbol` y sigue aceptando `putPremium` y `spotPrice`, sin usarlos como límite.
- **Código**: `hedging.service.js` (orquestador de patas, Auto-Collar, Protective Put y collar manual), modelo `HedgingStrategy` y repositorio de Supabase.
- **Datos**: estado `PARTIALLY_EXECUTED` y campos de orden por pata; posible migración de la restricción de `status` en Supabase.
- **Depende de**: `ordenes-y-lecturas-fieles-al-broker` (cancelación y estados confiables) y `cadena-de-opciones-real` (cadena y selección del Core 004).
- **Evidencia**: implementación asistida por IA, registrada en el `REPORT-DrFIC.md` del change.

## Riesgos de integración

- **Semántica del límite en `COVERED_STOCK` de Webull** → se confirma con `preview_option` antes de fijarla (tarea 1.2).
- **Restricción de `status` en Supabase** → se verifica y, si existe, se migra antes de desplegar (tarea 1.1).
- **Una orden se llena mientras se cancela** → se consulta el estado después de cancelar y se guarda lo que reporte el broker.

## Plan de validación y rollback

- **Validación**: pruebas `node:test` de todos los escenarios con dobles de broker, y una verificación manual en la cuenta paper con un collar y un Protective Put.
- **Rollback**: revertir. Los registros `PARTIALLY_EXECUTED` siguen siendo legibles, pero el enum anterior no permite volver a guardarlos, así que antes hay que revisarlos o cerrarlos.

## No-objetivos

- Cerrar automáticamente las patas ya ejecutadas.
- Reconciliar el estado de las estrategias con el llenado posterior.
- Un tope de desviación de precio entre la vista previa y la ejecución.
