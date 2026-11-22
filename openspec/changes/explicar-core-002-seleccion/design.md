# Design

## Context

Ver `proposal.md` para la motivación. `CoreResultsModal.jsx` ya separa la barra de pestañas (`role="tablist"`, con `gridTemplateColumns` derivado de `pestanas.length`) del `role="tabpanel"`. `CORES_INFO` es un descriptor estático compartido por la pestaña «Cómo se calcula» y por los textos de participación y datos clave. El backend ya informa `role: GATE` para el Core 002 no seleccionado, por lo que no hace falta tocar la API.

## Goals / Non-Goals

**Goals:**
- Que los textos de la UI describan exactamente el cálculo vigente, con umbrales y reglas verificables en el código.
- Explicar el efecto contraintuitivo del checkbox sin alterar pestañas, rejilla ni estados.
- Mantener la accesibilidad: etiqueta accesible, icono Lucide, cierre con `Escape` sin cerrar el modal y retorno de foco.

**Non-Goals:**
- Cambiar umbrales, F-Score, veto o cualquier cálculo en `fundamentalCore.js`.
- Documentar inexactitudes de `FUNDAMENTAL_CORE_EXPLICACION*` (se tratarán en otro change).
- Agregar bandeos de F-Score ni estimaciones de fecha de resultados.
- Modificar el contrato HTTP o la especificación OpenAPI.

## Decisions

**1. Textos cortos en `CORES_INFO`, detalle visual en un componente dedicado.**
Los campos `calculo`, `peso` y `participa` siguen siendo la fuente de los textos breves del descriptor, alineados con `docs/EXPLICACION_CORES_Y_RANKING.md`. La explicación detallada del 002 se renderiza en `ExplicacionCore002`, que el modal elige solo para ese core; los demás conservan `ComoSeCalcula`. Alternativa descartada: guardar el detalle como un párrafo largo en `CORES_INFO`, que reproduce el muro de texto que se quiere eliminar.

**2. Panel de ayuda como subcomponente local con estado en el modal.**
Un componente `AyudaSeleccion002` con `useState` para `abierto` y `useRef` para el botón. Se renderiza condicionalmente cuando `coreId === '002'` y se coloca en un contenedor flex junto a la barra de pestañas, fuera del elemento `role="tablist"`. Así `pestanas`, `visible` y `gridTemplateColumns` quedan intactos. Alternativa descartada: añadir una cuarta pestaña, que cambiaría la rejilla y obligaría a ajustar `visible`.

**3. `Escape` en dos niveles con prioridad del panel.**
El modal ya intercepta `Escape` y llama a `onClose()` con `stopPropagation()`. El panel registrará su propio `onKeyDown`: si está abierto, cierra el panel, hace `stopPropagation()` y devuelve el foco al botón; si está cerrado, no interviene. Alternativa descartada: consultar el estado del panel desde `alPresionarTecla`, que acoplaría el modal a un detalle de un solo core.

**4. Contenido del panel como constantes cercanas al componente.**
Los dos bloques son textos estáticos y específicos del modal, por lo que viven junto a `AyudaSeleccion002`. No se agregan a `CORES_INFO` porque no forman parte de la pestaña «Cómo se calcula».

**5. Semáforo visual sin bandeos de F-Score.**
Los umbrales de Altman se muestran en mini-tablas con badges rojo/ámbar/verde y las nueve pruebas de Piotroski como chips; la barra segmentada representa una prueba por bloque (mínimo 6 válidas). No se incluye la leyenda 0–3 / 4–6 / 7–9: el cálculo no implementa esos bandeos y el aporte real es `aprobadas/evaluables`. Se reutilizan utilidades Tailwind suaves ya presentes en el cliente (`bg-rose-50`, `bg-amber-50`, `bg-emerald-50`, `bg-slate-50`).

**6. Tabla dedicada para el Core 002 con orden solo local.**
`TablaCore002` deriva de `empresasEvaluadas(data)` pero mantiene el criterio de orden en estado local: la API sigue siendo la única fuente del `rank`. El control usa `role="group"` con `aria-pressed`, dentro del panel pero fuera del `tablist`, para no alterar la rejilla de pestañas. Los grupos «Candidatas en Ranking» y «Excluidas» se conservan en ambos modos; dentro de cada grupo se aplica el criterio elegido. Alternativa descartada: mutar el arreglo de la respuesta o recalcular ranks en el cliente, que desincronizaría la tabla del ranking global.

**7. Detalle individual dedicado y trazabilidad plegada.**
`DetalleFundamental002` sustituye a `CoreDetail` solo en la tabla del 002: ocho tarjetas con los campos ya presentes en `result`. La zona de Altman usa `altman.lower`/`altman.upper` cuando la API los informa (1.81/2.99 o 1.10/2.60); si faltan, se usa el par por defecto 1.81/2.99 solo para la etiqueta visual. Los nueve segmentos de Piotroski se derivan de `piotroski.tests` y, si ese mapa no viene, de `passed`/`evaluated`. El mapa completo se ordena por las claves reales de `fScore` en `fundamentalCore.js` (`positiveRoa`, `positiveCashFlow`, `improvedRoa`, `operatingCashAboveIncome`, `reducedLongDebt`, `improvedCurrentRatio`, `nonDilutionProxy`, `improvedGrossMargin`, `improvedTurnover`); cada segmento lleva un popover `group-hover` con nombre, descripción y pill de estado, alineado a los bordes de la tarjeta en los extremos para no salirse del modal. El motivo `UNVERIFIED` se mantiene visible fuera del acordeón para no perder la causa; el resto de la evidencia queda detrás de «Ver trazabilidad». Alternativa descartada: reutilizar `CoreDetail`, que vuelve al texto concatenado y a la lista cruda de evidencia.

**8. Tooltips generales en las KPI cards.**
`Tarjeta` centraliza un mapa `EXPLICACIONES` con una frase por etiqueta, sin fórmulas ni códigos: describe qué significa cada métrica en lenguaje llano. La etiqueta es enfocable y usa `aria-describedby` hacia un `role="tooltip"` hermano; el popover se alinea a la derecha en las tarjetas pares y a la izquierda en las impares, de modo que funcione tanto en la rejilla de 2 columnas como en la de 4. Alternativa descartada: repetir las reglas técnicas de `fundamentalCore.js`, que fue lo que el usuario pidió evitar.

**9. Modal más ancho solo para el 002 con cabecera fija.**
El contenedor del 002 añade `w-[95vw] max-w-6xl !max-h-[90vh]`: el prefijo `!` es necesario porque `.ui-dialog` se declara después de las utilidades de Tailwind 3 y gana en cascada. En móvil se conserva `100dvh`. Las pestañas salen del `role="tabpanel"` y pasan a un contenedor `flex-none` junto al header; el panel recibe `ui-dialog-body min-h-0 flex-1`, que es el único con scroll. Alternativa descartada: agrandar `.ui-dialog` globalmente, que cambiaría los otros seis cores.

**10. Sección sobre no seleccionar el 002 dentro de «Cómo se calcula».**
`NO_SELECCIONADO` guarda dos grupos de cuatro frases en lenguaje llano; `ExplicacionCore002` los renderiza con los mismos `Seccion`, `Tarjeta` y puntos `PUNTO` que ya usa el panel. Se ubica al final, después del pie de peso y regla GATE, para no desplazar los semáforos. Alternativa descartada: ampliar el popup de ayuda, que ya tiene comportamiento `Escape`/foco y quedaría demasiado denso; se conserva como resumen.

## Risks / Trade-offs

- [El texto del panel quede desactualizado si cambia el peso] → Derivar el 25 % y el peso 20 de constantes compartidas incrementaría el acoplamiento; se mitig con una prueba que verifica los números en el texto y la sincronización con la documentación.
- [El panel quede fuera del orden de foco del modal] → El `querySelectorAll(ENFOCABLES)` del modal incluye los controles renderizados condicionalmente; se cubre con una prueba de foco.
- [Escape cierre el modal en lugar del panel] → El `stopPropagation()` del panel va antes del handler del modal; se cubre con una prueba explícita.
- [Textos muy largos en móvil] → La pestaña ya permite desplazamiento vertical; el panel será compacto y no permanente.
- [El orden por puntaje mezcle excluidas con candidatas] → Se conserva la separación de grupos en ambos modos y se explica en el pie de la tabla; el `rank` global nunca se recalcula en el cliente.
- [Un `exclusionType` nuevo sin traducir] → El componente cae a la etiqueta neutra «Datos incompletos» en lugar de mostrar el código crudo.
- [Umbrales de Altman ausentes en la respuesta] → La etiqueta usa 1.81/2.99 como referencia visual; el veredicto de la API no se recalcula.
- [`piotroski.tests` incompleto] → Los huecos se pintan con borde punteado y el `aria-label` sigue mostrando `aprobadas/evaluables` tal cual vino.
- [Ancho insuficiente en pantallas pequeñas] → El modal vuelve a `100dvh` en `max-sm` y el grid de KPI cards pasa a dos columnas.

## Migration Plan

Sin migración de datos ni de contrato. Se despliega el cliente y se sincroniza el documento. Rollback: revertir los tres archivos de texto/componente y la doc; no hay estado persistente que limpiar.

## Open Questions

Ninguna. El correo real para `SEC_EDGAR_USER_AGENT` es configuración de entorno, no parte de este change.
