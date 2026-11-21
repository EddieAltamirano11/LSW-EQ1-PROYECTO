# Tasks

## 1. Pruebas primero

- [x] 1.1 Crear series diarias de prueba versionadas, de dos años, con tendencias, cruces y niveles conocidos. Escribir las pruebas que fallan de niveles puntuados, tendencias con fecha de confirmación, tramos e historial insuficiente.
- [x] 1.2 Escribir las pruebas que fallan de la proyección (convergencia, separación y horizonte), de la precisión medida (incluida la muestra insuficiente) y de la lectura de indicadores (zonas del RSI y clases del ADX).
- [x] 1.3 Escribir la prueba que asegura que el puntaje, la dirección y la confianza del Core 001 no usan la proyección.

## 2. Implementación

- [x] 2.1 Ampliar la ventana diaria a dos años en `obtenerHistorialVelas` y reportar como no disponibles las escalas sin velas suficientes.
- [x] 2.2 Implementar los niveles puntuados y las tendencias en tres escalas, con su fecha de confirmación y sus tramos.
- [x] 2.3 Implementar la proyección por convergencia de medias y la precisión walk-forward.
- [x] 2.4 Exponer en el resultado la lectura de indicadores: RSI, MACD, ADX con ±DI y Bollinger.

## 3. Verificación, contrato y evidencia

- [x] 3.1 Verificar con datos reales de al menos tres empresas y registrar los resultados con fecha. Actualizar `spec/openspec.yaml`, el ejemplo de Postman y `docs/EXPLICACION_CORES_Y_RANKING.md`.
- [x] 3.2 Ejecutar `npm test` y `npm run test:api-quality`, y registrar la evidencia.
- [x] 3.3 Crear el `REPORT-DrFIC.md` del change y correr `openspec validate core-tecnico-historico-dos-anios` cuando el CLI esté disponible.
