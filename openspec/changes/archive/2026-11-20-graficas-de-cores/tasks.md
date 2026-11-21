# Tasks

## 1. Pruebas primero

- [x] 1.1 Escribir las pruebas que fallan del endpoint: contrato con datos, `401`, `400` y `503`.
- [x] 1.2 Escribir las pruebas que fallan de las funciones de datos y de componente:
  - payoff con puntos y métricas iguales a los del Core 004;
  - contribuciones (peso por puntaje) que suman el puntaje de la confluencia;
  - selector de la columna central con TradingView por defecto;
  - vista técnica sin datos, que muestra la causa.

## 2. Vista técnica en la columna central

- [x] 2.1 Implementar `GET /api/v2/strategy-screener/technical/:symbol`, reutilizando la serie y los cálculos del Core 001, con caché de 90 s.
- [x] 2.2 Agregar `lightweight-charts` con versión exacta y el componente de gráfica técnica con carga diferida: velas, bandas de soporte y resistencia, tramos, medias y ventana proyectada.
- [x] 2.3 Agregar en `TradingViewWidget` el selector «TradingView / Core técnico», con TradingView por defecto, sincronizado con el activo seleccionado y con estado sin datos.

## 3. Gráficas del modal (requiere `detalle-de-cores-en-modal`)

- [x] 3.1 Implementar las gráficas SVG de payoff (004) y de contribución (007), con su resumen accesible.
- [x] 3.2 Agregar la pestaña Gráfica a la consulta de 001, 004 y 007, reutilizando el componente técnico.

## 4. Contrato, verificación y evidencia

- [x] 4.1 Documentar el endpoint en `spec/openspec.yaml` y en las colecciones Postman.
- [x] 4.2 Ejecutar las pruebas y el build, revisar que la librería quede en un chunk aparte y revisar en escritorio y móvil. Crear el `REPORT-DrFIC.md` y correr `openspec validate graficas-de-cores --strict`.
