# Proposal

## Why

El profesor pidió mostrar en la tabla del ranking el resultado del Core 004 (estrategias). Hoy las columnas Piso Put, Techo Call, Prima Neta y Retorno Máx. vienen del escáner teórico de Black-Scholes, aunque el Core 004 ya calcula el collar real con cotizaciones observadas. Además, la columna de cores marca como «Veto Cores» cualquier exclusión, aunque la causa sea falta de datos o que no haya un collar líquido.

## What Changes

- **Collar real en el ranking**: después de evaluar los cores, las columnas de collar muestran el collar del Core 004 de cada empresa apta, con la marca «Real · Core 004» y la hora de cotización:
  - strike y vencimiento del Put y del Call;
  - prima observada (`ask` del Put, `bid` del Call);
  - costo neto como débito o crédito;
  - retorno máximo.
- **Valores teóricos marcados**: antes de evaluar, y en las filas sin collar del Core 004 (por ejemplo, ETFs o empresas excluidas), las columnas muestran los valores del escáner marcados como teóricos.
- **Probabilidad**: en las filas con collar real, la columna de probabilidad indica que la probabilidad teórica no aplica, porque el escáner la calcula para otro strike.
- **Motivo de exclusión**: la columna de cores distingue veto de viabilidad, sin collar líquido y datos insuficientes, y muestra la causa. Para eso, la API agrega `exclusionType` a cada empresa excluida.
- **Pruebas del cliente**: se agregan Vitest y React Testing Library para probar la lógica nueva de la tabla.
- La emisión del collar del ranking desde la columna derecha se planea en `ejecucion-de-coberturas-multipata` y `panel-de-ordenes-con-datos-reales`.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `strategy-screener-api`: requisito nuevo con el tipo de exclusión de cada empresa.
- `presentacion-frontend-react`: requisito nuevo con el collar del Core 004 en el ranking.

## Impact

- **Endpoints**: `POST /api/v2/strategy-screener/run` agrega `exclusionType` en `excluded`. Es un cambio aditivo y compatible.
- **Código**: `strategyScreener.service.js`, la tabla del ranking en `Dashboard.jsx` y un módulo nuevo de mapeo en `client/src/services/`.
- **Dependencias**: `vitest`, `@testing-library/react` y `jsdom` como dependencias de desarrollo del cliente.
- **Coordinación**: `escaner-sin-precios-fijos` renombra `marketPremium` a `theoreticalPremium`; la tabla debe usar el nombre vigente cuando se implemente.
- **Evidencia**: implementación asistida por IA (Claude Code), registrada en el `REPORT-DrFIC.md` del change.

## Riesgos de integración

- **Signo de la prima**: el escáner expresa el crédito como positivo (`call − put`) y el Core 004 expresa el débito como positivo (`ask` del Put − `bid` del Call). Se normaliza a «Débito» o «Crédito» explícito.
- **Orden con `escaner-sin-precios-fijos`**: ambos tocan las mismas columnas; el que se implemente después adapta el nombre del campo.

## Plan de validación y rollback

- **Validación**: `npm test`, pruebas del cliente con Vitest, build y revisión manual en escritorio y móvil, antes y después de evaluar los cores.
- **Rollback**: revertir el commit; `exclusionType` es aditivo.

## No-objetivos

- Emitir el collar desde la fila de la tabla: la emisión sigue en la columna derecha.
- Cambiar la selección o las reglas del Core 004.
- Calcular probabilidades con volatilidad implícita.
