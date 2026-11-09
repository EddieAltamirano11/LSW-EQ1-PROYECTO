# Diseño

## Context

`App.jsx` alterna entre el acceso React y el dashboard según la sesión local. El cliente usa React, Vite, Tailwind y Lucide. `index.css` y las clases de cada componente definen actualmente fondos oscuros, texto claro y acentos índigo. El login público en `public/login` pertenece a otro flujo, documentado en la especificación `inicio-sesion`. Para la motivación del cambio, véase [la propuesta](proposal.md).

El inventario se obtuvo leyendo `client/src` y comparándolo con `los-eddies-maquetado.html`, la maqueta entregada en la conversación.

| Vista | Controles y comportamiento actual | Comparación con la maqueta y decisión |
| --- | --- | --- |
| Acceso React | Usuario y contraseña con valores iniciales y campos requeridos. Selectores MongoDB y Supabase, e IBKR, Alpaca y Webull. Inicia en MongoDB y Webull. El botón de acceso queda deshabilitado durante el envío. | Adoptar el formulario claro, el panel verde y el tratamiento visual de las opciones. Mantener los valores, validaciones y envío del formulario actual. La contraseña ilustrativa de la maqueta no se incorpora. |
| Ajustes y recuperación | Panel plegable de servidor, campo de URL, presets Render Cloud y Local (3050). Ante un error, el aviso ofrece «Apuntar a Render Cloud» y «Acceso Rápido Demo». | La maqueta hace permanente el acceso demo, usa un campo de tipo URL y omite el aviso de error con sus acciones. Conservar el campo, los manejadores, la condición de error y las dos acciones de recuperación actuales. |
| Sesión y contexto | Restauración de sesión local, distintivos de base y broker activos, y botón Salir que vuelve al acceso. | Tomar la cabecera verde y sus distintivos. La vista de entrada depende de la sesión existente, aunque la maqueta abra directamente en el dashboard. |
| Escáner | «Escanear Ahora», Top 5 y Top 10, ranking por probabilidad, prima neta o retorno, vencimiento de 30, 45 o 60 días y botón de criterios. Valores iniciales Top 5, probabilidad y 45 días. Escaneo al montar, al cambiar filtros y bajo demanda. | Adoptar la distribución de la maqueta. Mantener los valores enviados `probability`, `netCredit` y `maxReturn`, el estado de carga y la presentación de resultados vacíos. La maqueta usa datos y claves internas distintos. |
| Ranking | Posición, empresa/ticker/mercado, precio spot, tendencia, piso Put, techo Call, prima neta, probabilidad y sweet spot, retorno máximo y acciones por candidato. Incluye primas, moneyness y montos asociados. La fila y su botón TradingView seleccionan el activo. | Mantener las columnas y detalles actuales aunque estén abreviados en la maqueta. Hacer que en móvil los datos se reorganicen por candidato y las acciones sigan a la vista. |
| TradingView | Gráfico avanzado, análisis técnico y enlace «Abrir en TradingView». El gráfico usa el símbolo seleccionado, los estudios vigentes y el iframe de respaldo cuando corresponde. | Adoptar el contenedor claro y la disposición adaptable. Los gráficos de ejemplo de la maqueta quedan como referencia de composición. |
| Órdenes y avisos | Selector Simulado / Real, banner de ejecución en vivo con «Cambiar a Simulación», «Ejecutar» o «Emitir a Broker» por fila según el modo y cierre del aviso de resultado. El dashboard inicia en Real. Durante una ejecución se deshabilita la acción del candidato correspondiente. | La maqueta abre en Simulado y usa mensajes de ejemplo. Conservar el modo inicial Real, sus advertencias, los mensajes, las condiciones y los manejadores actuales. El estilo debe mantener clara la diferencia entre modos. |
| Modal de criterios | Se abre con «¿Qué debe cumplir una empresa?». Presenta los cuatro pilares con umbrales y explicaciones, y se cierra con la X o «Entendido y Validado». | Tomar el diseño del modal claro. Mantener los textos completos, las reglas y ambos controles de cierre. |
| Modal de respuesta | Identifica el símbolo, el modo, el broker, la base, el vencimiento y el estado HTTP. Muestra el mensaje, las tres patas, métricas y, si existen órdenes en la respuesta, su tabla con el estado y los identificadores. Permite expandir y ocultar el JSON, copiarlo y cerrar con la X o «Aceptar y Cerrar». | Aplicar el estilo claro al contenido actual. Mantener los indicadores de éxito y rechazo, los detalles condicionales, la información de persistencia y la retroalimentación de copia. Los códigos y respuestas de ejemplo de la maqueta no determinan la UI del cliente. |

## Goals / Non-Goals

**Objetivo.** Compartir las reglas visuales entre las vistas de React y conservar el acceso a sus acciones en escritorio y móvil.

**Fuera de alcance.** Cambios al login público, a las rutas y contratos de API, a los servicios y al comportamiento de autenticación, sesión, escaneo, persistencia y ejecución. También quedan fuera los cambios a la configuración de despliegue y la ejecución de órdenes durante la verificación.

## Decisions

### Usar los componentes y el sistema de estilos actuales

Definir la paleta y las reglas visuales compartidas en `client/src/index.css`. Usar verde bosque `#193b2d` en la cabecera y el panel de acceso, verde `#254d38` en acciones principales, fondo `#f1f3ef` y superficies blancas. Aplicar el acento claro `#c6eaa8` sobre verde oscuro y reservar tonos diferenciados para el modo real, éxito y error, siempre acompañados de texto. Ajustar el marcado, las clases Tailwind y los estilos en los componentes existentes. Esto centraliza los colores repetidos y mantiene cerca de cada vista sus reglas de disposición. Importar el HTML o el CSS completo del login público acoplaría dos pantallas con formularios y estilos distintos.

El acceso puede reutilizar el recurso gráfico del login público como recurso estático empaquetado por Vite bajo `client/src`, si se usa en la composición. Así funciona tanto en la publicación estática como al servir el cliente en `/dashboard`. La maqueta define la composición de referencia. Sus scripts, datos, mensajes y recursos de la conversación quedan fuera del cliente.

### Adaptar la disposición conservando los datos y las acciones

En escritorio, mantener el escáner, ranking y análisis en secciones reconocibles y usar tablas para comparar candidatos y órdenes. En móvil, apilar filtros y widgets, reordenar la información del ranking por candidato y conservar los botones de cada fila junto a sus datos. Reservar el desplazamiento horizontal interno para datos densos del modal de respuesta cuando haga falta, manteniendo fuera de esa zona los controles de cierre y copia. Un desplazamiento horizontal para todo el ranking dejaría las acciones alejadas del ticker y dificultaría localizarlas.

Usar como referencias de revisión 360 px y 1280 px de ancho. Mantener etiquetas legibles, foco visible, orden de lectura coherente y controles accesibles por teclado, con los mismos eventos y condiciones de visibilidad.

### Conservar el contrato del cliente

Mantener los manejadores y condiciones de `App.jsx`, `LoginView.jsx`, `Dashboard.jsx`, `TradingViewWidget.jsx` y ambos modales. Conservar los valores de sesión y su almacenamiento, la resolución de la URL de API, las solicitudes y sus respaldos, y el uso de `computeLocalCandidates` ante los fallos que actualmente lo activan. En TradingView, limitar los ajustes al contenedor y a los parámetros de apariencia compatibles con las vías de carga existentes, preservando el símbolo, los estudios, el diagnóstico, el enlace y el respaldo por iframe.

El rediseño no requiere extraer lógica ni tocar los servicios compartidos de autenticación, escaneo o ejecución del servidor. El cambio `v2-screener-tradingview` especifica el endpoint de escaneo y las rutas versionadas. Esta propuesta agrega criterios de presentación del cliente y conserva esos contratos.

## Risks / Trade-offs

- Adoptar un valor, texto condicional o dato de ejemplo de la maqueta podría cambiar el comportamiento. Usar el inventario y revisar el diff de estados, eventos, solicitudes y condiciones antes de dar por terminado el cambio.
- Las etiquetas de filtros, las tablas y el JSON pueden desbordar en móvil. Comprobar que los controles se mantienen dentro de la ventana y que cualquier desplazamiento de datos queda contenido.
- Las vistas que requieren una respuesta del broker o de la base de datos se verifican por lectura del JSX y sus condiciones cuando no se pueden observar dentro del alcance autorizado. Registrar la cobertura visual real sin activar ejecuciones ni fabricar respuestas.

## Migration Plan

El cambio produce una nueva compilación estática del cliente con el comando existente. La revisión se realiza sobre esa compilación y el diff de presentación. Si hace falta revertir la apariencia, se puede volver al paquete estático anterior.
