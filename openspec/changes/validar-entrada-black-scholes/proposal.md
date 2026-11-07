# Proposal

## Why

`POST <API_URL>/quant/black-scholes` puede responder con cálculos `null` ante campos faltantes o texto no numérico, y con un error interno ante `optionType: null`. Se necesita una validación HTTP explícita, especificada antes de implementar, que permita demostrar el uso de OpenSpec sin alterar el motor financiero compartido.

## What Changes

- Validar el cuerpo, los parámetros numéricos y el tipo de opción antes del cálculo; devolver errores `400` comprensibles mediante el manejador existente.
- Conservar las respuestas para entradas válidas, las cadenas numéricas aceptadas, CALL/PUT sin distinción de mayúsculas y los valores predeterminados actuales.
- Evitar respuestas exitosas con resultados no finitos cuando los valores excedan la capacidad numérica del cálculo.
- Separar la validación del transporte de las fórmulas compartidas, justificando la estructura elegida y permitiendo una estructura propia si la existente no sirve al alcance.
- Completar `openspec/config.yaml` con el contexto y las reglas de estructura y trazabilidad IA/manual solicitadas para la actividad.
- Documentar el contrato OpenAPI, los ejemplos Postman afectados y la evidencia de antes/después, identificando esta mejora como asistida por IA y dejando la optimización manual como pendiente de evidencia real.

## Capabilities

### New Capabilities

- `validacion-black-scholes`: Contrato de validación y compatibilidad del endpoint de valuación Black-Scholes, con errores claros y resultados finitos.

### Modified Capabilities

Ninguna. La única capacidad publicada es `inicio-sesion`; su comportamiento no cambia.

## Impact

- Controlador de Black-Scholes, un módulo de validación específico y pruebas HTTP locales.
- `openspec/config.yaml`, la sección Black-Scholes de `spec/openspec.yaml`, los ejemplos relacionados en las colecciones Postman y un documento de evidencia enlazado desde `README.MD`.
- Sin dependencias nuevas, cambios en autenticación, conexiones a bases o brokers, ni cambios en `quant.service.js`, sus fórmulas, sus consumidores de cobertura o el endpoint de volatilidad implícita.
