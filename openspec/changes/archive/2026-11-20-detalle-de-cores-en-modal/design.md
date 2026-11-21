# Design

## Context

- **Componentes ocultos**: `CoreResult` y `CoreDetail` (en `StrategyScreenerPanel.jsx`) muestran las métricas, la evidencia y el estado de cada core por empresa, e incluso «Evaluado como dependencia». Solo se usan en la rama `hideAssetList = false`, que el Dashboard no monta.
- **Respuesta actual**: los cores seleccionables traen `active`; 004 y 007 no. El orquestador sabe qué cores calculó y por qué (selección, veto o dependencia), y la confluencia trae los pesos normalizados en `drivers`.
- **Resultados en el Dashboard**: `handleScreenerResults` ya guarda la respuesta en el estado `screenerData`.

## Goals / Non-Goals

**Goals:**
- Ver los resultados de cada core sin saturar el panel.
- Dejar explícito si cada core entró a la confluencia.
- Reutilizar lo existente.

**Non-Goals:**
- Gráficas.
- Vista por empresa desde el ranking.
- Cambios de cálculo.

## Decisions

### 1. `role` y `effectiveWeight` en el backend

El orquestador asigna `role` según la selección y el motivo por el que calculó cada core, y copia `effectiveWeight` de los `drivers` de la confluencia.

- *Alternativa descartada*: inferirlo en el cliente. Repetiría reglas del backend (por ejemplo, que Fundamental siempre se calcula para el veto) y se desincronizaría.

### 2. Botón separado del checkbox

El botón va fuera del `<label>` del checkbox, para que pulsarlo no cambie la selección. Usa el ícono `Eye` de lucide-react, como propuso el profesor, con tooltip y `aria-label`. Las filas de 004 y 007 no tienen checkbox y llevan la marca «Siempre activo» o «Resultado».

### 3. Modal y descriptor por core

El componente `CoreResultsModal` recibe el id del core y `screenerData`:

- **Tabla**: reutiliza `CoreResult` en modo compacto en cada fila y `CoreDetail` al expandirla.
- **Cómo se calcula**: sale de un descriptor estático por core en `client/src/services/coresInfo.js` (fuentes, ventanas, peso base y participación), alineado con `docs/EXPLICACION_CORES_Y_RANKING.md`.
  - *Alternativa descartada*: pedir esta explicación a la API. Es contenido estático y no lo justifica.

### 4. Accesibilidad y móvil

El modal es un diálogo modal (`aria-modal`), con foco inicial, cierre con Esc y retorno del foco al botón. En móvil ocupa toda la pantalla y la tabla tiene desplazamiento propio.

### 5. Limpieza

Después de mover `CoreResult` y `CoreDetail` a módulos propios, se elimina de `StrategyScreenerPanel.jsx` la rama `hideAssetList = false`, que no se usa en ninguna parte.

## Risks / Trade-offs

- [La respuesta del ranking crece] → impacto bajo: solo se agregan `role` y `effectiveWeight` a cada core.
- [La pestaña de gráficas todavía no existe] → la estructura de pestañas queda lista para `graficas-de-cores`.

## Migration Plan

1. Backend con los campos nuevos (aditivo).
2. Frontend con el botón y el modal.
3. Limpieza de la rama sin uso.

## Open Questions

- ¿Agregar después una vista por empresa, con todos sus cores, desde la columna de cores del ranking? Se propone para otro change.
