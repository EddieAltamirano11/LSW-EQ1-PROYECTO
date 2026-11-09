# Tareas

## 1. Estilos compartidos y acceso

- [x] 1.1 Definir en `client/src/index.css` la paleta, las superficies, los bordes y el foco visible. Aplicarlos a la raíz de React y verificar que el diff de `App.jsx` conserva la selección de vista y el almacenamiento de sesión.
- [x] 1.2 Adaptar el formulario y los ajustes de `LoginView.jsx` al diseño claro. Revisar a 360 y 1280 px los campos, selectores, presets y botón de acceso, incluido el recorrido por teclado. Cotejar en código los valores iniciales, la validación, el estado de carga y las acciones que aparecen tras un error, sin provocar un error de autenticación para revisarlas.

## 2. Panel, escáner y análisis

- [x] 2.1 Adaptar la cabecera del dashboard, los distintivos de sesión, Salir, el escáner, sus filtros y los estados de carga y sin resultados. Revisar la composición en ambos anchos cuando la vista esté disponible y cotejar los controles, sus valores iniciales y sus manejadores con el inventario del diseño.
- [x] 2.2 Adaptar el ranking para mantener las columnas en escritorio y los datos y acciones de cada candidato juntos en móvil. Revisar la disposición de las filas disponibles y comprobar en el JSX que permanecen todos los campos, la selección por fila y las acciones por candidato.
- [x] 2.3 Adaptar los contenedores del gráfico y del diagnóstico de TradingView. Revisar su disposición y comprobar por código que el símbolo seleccionado, los estudios, los widgets, el enlace y el respaldo por iframe siguen asociados como antes.

## 3. Modales y controles de órdenes

- [x] 3.1 Adaptar el modal de criterios al estilo claro. Revisar la legibilidad de los cuatro pilares, los umbrales y las explicaciones, y verificar que conserva los dos controles de cierre.
- [x] 3.2 Adaptar el selector de modo, el aviso de ejecución en vivo, las acciones por candidato y los avisos de resultado. Cotejar por código el modo inicial Real, las etiquetas según el modo, los estados de carga y los manejadores, sin pulsar «Ejecutar» ni «Emitir a Broker».
- [x] 3.3 Adaptar el modal de respuesta, sus métricas, la tabla condicional y el área de JSON. Comprobar mediante revisión de JSX y estilos el contexto, los estados HTTP, los controles de cierre, expansión y copia, y la gestión de desbordes. Esta revisión excluye ejecutar órdenes en cualquier modo o fabricar respuestas del broker o de la base de datos.

## 4. Verificación del frontend

- [x] 4.1 Compilar el cliente desde la raíz con `npm --prefix client run build` y verificar que Vite termina correctamente. Revisar el diff para confirmar que la implementación se limita a `client/src` y conserva rutas, solicitudes, headers, payloads, respaldos e integraciones.
- [x] 4.2 Completar la revisión visual en escritorio y móvil de las vistas que puedan observarse dentro del alcance. Para los estados que requieran ejecutar una orden o generar una respuesta del broker o de la base de datos, usar la revisión del código. Excluir órdenes simuladas y reales, respuestas simuladas y pruebas de integración con esos servicios.
- [x] 4.3 Registrar por vista el antes y el después, responsables, herramientas y verificaciones realizadas. Distinguir la asistencia de IA del trabajo manual acreditado e identificar las vistas o estados que se revisaron únicamente en código.

## Evidencia de implementación

Codex realizó la implementación y las verificaciones de este registro con asistencia de IA.

| Vista | Antes | Después | Verificación realizada |
| --- | --- | --- | --- |
| Acceso y ajustes | Formulario oscuro de una columna con acentos índigo. | Panel verde con el gráfico de Los Eddies, formulario claro y opciones agrupadas. | Cliente compilado en Chromium a 360 y 1280 px. Recorrido por teclado, foco visible, opciones iniciales y ambos presets. La rama de error y el acceso rápido demo se revisaron en código. |
| Cabecera, escáner y órdenes | Cabecera oscura y filtros con el estilo anterior. | Cabecera verde, contexto de sesión legible, filtros apilados en móvil y aviso ámbar para el modo Real. | Renderizado estático a 360 y 1280 px y cotejo de valores y manejadores con la versión anterior. Las acciones de órdenes y sus avisos se revisaron en código. |
| Ranking | Tabla oscura con desplazamiento horizontal en móvil. | Tabla clara en escritorio y datos y acciones agrupados por candidato en móvil. | Estado sin candidatos revisado visualmente en ambos anchos. Las filas con datos y sus acciones se cotejaron en JSX y CSS. |
| TradingView | Contenedores y widgets oscuros. | Contenedores claros adaptables y parámetros de tema claro. | Disposición inicial estática a ambos anchos. El símbolo, los estudios, el enlace y las vías de carga se cotejaron en código. [Gráfico avanzado](https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart) y [análisis técnico](https://www.tradingview.com/widget-docs/widgets/symbol-details/technical-analysis/?widget_symbol=CRYPTO%3ALDOUSD). |
| Criterios | Modal oscuro con los cuatro pilares. | Modal claro con encabezado y cierre visibles y contenido desplazable. | Renderizado estático en ambos anchos. Se comprobó el desplazamiento por teclado en móvil y se cotejaron los dos controles de cierre. |
| Respuesta del broker | Modal oscuro con tabla de órdenes y botón de copia superpuesto al JSON. | Modal claro con tabla de desplazamiento interno y copia fuera del bloque JSON. | Revisión de JSX y estilos, incluidos estados, tabla condicional, contenido del JSON y manejador de copia. |

`npm --prefix client run build` compiló el cliente correctamente. La revisión comparó la lógica previa al renderizado y las acciones de los controles con el código anterior, con los ajustes de apariencia y el título accesible del iframe de TradingView como diferencias previstas. La revisión visual se hizo con Chromium y Playwright a partir del acceso compilado y del renderizado estático del panel y del modal de criterios. Las verificaciones se limitaron a presentación, compilación y lectura de código.
