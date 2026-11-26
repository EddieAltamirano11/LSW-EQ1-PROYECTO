# Design

## Context

El servicio v2 calcula diagnósticos con evidencia y aplica el filtro fundamental y el filtro de liquidez del collar. La confluencia ordena candidatas. React conserva el ticker seleccionado y el panel de cores controla los criterios de evaluación.

## Goals / Non-Goals

El análisis interpreta los diagnósticos del escáner para un Collar Spread con el horizonte elegido. El modelo consulta datos de mercado y diagnósticos de emisoras. La ejecución de inversiones se mantiene como decisión del usuario mediante los controles existentes.

## Decisions

- Una ruta autenticada dedicada devuelve la evaluación por separado. Invocarla en el flujo de `/run` agregaría latencia, dependencia y costo a cada cálculo del ranking.
- El servicio reutiliza la misma evaluación por empresa y las lecturas temporales del escáner. La modalidad individual limita la evaluación al ticker solicitado. El backend recibe criterios, obtiene las observaciones y resuelve vetos, datos faltantes y el estado del calendario.
- Un conjunto acotado de diagnósticos y métricas alimenta Gemini 3.1 Flash-Lite mediante `generateContent`. Es el proveedor predeterminado. OpenAI queda disponible mediante selección explícita. Cada proveedor adapta la solicitud y la respuesta al mismo esquema. Las sugerencias comparan hasta diez candidatas evaluables y muestran hasta tres. El servidor comprueba las citas por empresa y adjunta la evidencia fechada.
- React usa la selección y los filtros vigentes. La consulta se inicia por botón y los resultados se retiran al cambiar el contexto que los produjo. Un punto basado en conocimiento general usa un identificador nulo y el panel lo marca como «Contexto general».

## Risks / Trade-offs

- El nivel gratuito de Gemini tiene cuotas. El servidor devuelve la causa si el proveedor rechaza la solicitud o alcanza su cuota y usa un límite temporal por proceso y un tiempo máximo por consulta.
- Un modelo puede interpretar una métrica de manera imperfecta. La respuesta identifica el alcance de la evaluación y adjunta la evidencia del servidor para que el usuario pueda contrastarla.

## Migration Plan

Configurar `GEMINI_API_KEY` de un proyecto gratuito de Google AI Studio en el backend. `GEMINI_AI_MODEL` permite elegir otro modelo compatible con salidas estructuradas. Para seleccionar OpenAI, configurar `AI_PROVIDER=openai` y `OPENAI_API_KEY`.
