# Evidencia de implementación

Antes del cambio, el panel mostraba el ranking cuantitativo y el detalle de cada core. Después del cambio, ofrece dos consultas de IA para Collar Spread con veredicto, motivos, riesgos y referencias a las observaciones del escáner.

Codex preparó el diseño, la implementación, las pruebas y la documentación a petición del usuario. La revisión humana queda pendiente.

| Verificación | Resultado |
| --- | --- |
| Suite Node.js | 145 pruebas aprobadas. El caso de integración compara el resultado de `/run` antes y después de la consulta de IA y comprueba que coincida íntegramente. |
| Consultas de IA | Casos controlados para ticker fuera de la canasta, candidatas elegibles, vetos, fallo o ausencia de datos, citas ajenas a la empresa, configuración y límite temporal. |
| Suite React | 85 pruebas aprobadas. Incluye ejecución explícita, fuentes fechadas, respuestas tardías y aislamiento de errores del ranking. |
| Build de React | `npm --prefix client run build` completado. |
| Contrato | OpenSpec validado en modo estricto. Se analizaron el YAML de OpenAPI y las solicitudes de las dos colecciones Postman con el validador de entrada de la API. |

Se usó un transporte controlado para comprobar la solicitud y la respuesta estructurada de OpenAI. La prueba con OpenAI en vivo queda pendiente porque el entorno carece de `OPENAI_API_KEY`.

## Integración con Gemini

Codex añadió Gemini 3.1 Flash-Lite como proveedor predeterminado a petición del usuario. La suite Node.js pasó 146 pruebas, incluida la ruta de análisis con transporte controlado de Gemini, la validación de citas, los errores de cuota y la selección explícita de OpenAI. La prueba de regresión obtuvo el mismo ranking antes y después de consultar Gemini.

El cliente pasó 85 pruebas y compiló correctamente. Se validaron OpenSpec en modo estricto, OpenAPI y los ejemplos de ambas colecciones Postman. La prueba con Gemini en vivo queda pendiente porque el entorno carece de `GEMINI_API_KEY`.

## Recomendaciones breves

Codex actualizó el prompt, la validación y el panel para presentar las mejores candidatas con motivos breves y riesgos respaldados cuando correspondan. Con un transporte controlado se verificó el orden de las sugerencias, la lista de riesgos vacía, las citas y la igualdad del ranking antes y después de la consulta. El cliente comprobó que el apartado de riesgos solo aparece en las tarjetas que lo necesitan.

Pasaron 146 pruebas de Node.js, 86 de React, el build y las validaciones de OpenSpec y OpenAPI. La redacción generada por Gemini en vivo queda fuera de esa verificación.

## Primera sugerencia y explicación de riesgos

Codex añadió «La que mejor califica» a la primera candidata y «Por qué podría no convenir» a las tarjetas con riesgos. Pasaron las pruebas dirigidas de ambos proveedores y las nueve pruebas del panel. Una consulta en vivo a Gemini 3.1 Flash-Lite con una empresa ficticia devolvió un motivo de espera en lenguaje cotidiano y citó la evidencia suministrada.

## Contexto general del modelo

Codex ajustó el prompt para que el modelo pueda complementar los datos del escáner. Pasaron 146 pruebas de Node.js y 86 de React. Se verificaron la etiqueta de contexto, la validación de citas y la regresión del ranking. Gemini 3.1 Flash-Lite aceptó el esquema actualizado y devolvió un punto sin cita en una consulta en vivo con una empresa ficticia.

## Tiempo de espera de sugerencias

Codex amplió de 30 a 60 segundos el plazo para comparar candidatas con Gemini y añadió un reintento dentro del mismo plazo ante un `503` de Google. Se reprodujeron en vivo el tiempo de espera y un `503` de Google antes del ajuste final. La prueba posterior devolvió tres sugerencias válidas de diez empresas ficticias en 1.9 segundos.

Pasaron 148 pruebas de Node.js, incluidas una respuesta a los 35 segundos, la cancelación al vencer el plazo y la recuperación tras un `503` controlado. La verificación en Render queda pendiente de un despliegue.
