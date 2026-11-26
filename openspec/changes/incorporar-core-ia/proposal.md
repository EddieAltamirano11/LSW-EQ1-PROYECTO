# Proposal

## Why

El escáner entrega indicadores y puntajes por empresa. Una consulta de IA puede ayudar a interpretar la evidencia y a identificar oportunidades para revisar en el horizonte de Collar Spread elegido.

## What Changes

- Añadir un Core de IA con sugerencias de candidatas y un veredicto para la empresa seleccionada, con motivos, riesgos y evidencia.
- Incorporar una consulta autenticada bajo `/api/v2/strategy-screener/ai-analysis` que recibe criterios y evalúa en el servidor.
- Configurar Gemini 3.1 Flash-Lite como proveedor predeterminado para poder probar el Core con el nivel gratuito de Google AI Studio.
- Mantener el Core 007 como responsable del puntaje y el ranking cuantitativo. La consulta es de solo lectura.

## Capabilities

### New Capabilities

- `analisis-collar-con-ia` describe la consulta, los veredictos y su evidencia en el dashboard.

### Modified Capabilities

## Impact

API v2, panel de cores en React, contrato OpenAPI y colecciones Postman. El proveedor y su clave se configuran en el servidor. El cambio es aditivo para los contratos existentes. Las pruebas y la autoría se registran en la evidencia del cambio.
