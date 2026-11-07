# Spec Delta

## Purpose

Permitir que los consumidores de la valuación Black-Scholes reciban resultados utilizables o errores de entrada comprensibles, conservando el comportamiento de las solicitudes válidas existentes.

## ADDED Requirements

### Requirement: Cuerpo y parámetros numéricos válidos

`POST <API_URL>/quant/black-scholes` SHALL aceptar un objeto JSON con `spotPrice`, `strikePrice` y `timeToExpirationYears` obligatorios y estrictamente positivos. `volatility`, cuando se proporcione, SHALL ser estrictamente positiva; `riskFreeRate` SHALL aceptar valores finitos, incluyendo cero y negativos. Cada parámetro numérico SHALL aceptar un número finito o una cadena no vacía que se convierta a un número finito. Valores nulos, booleanos, arreglos, objetos, cadenas vacías o no numéricas y valores no finitos SHALL producir un error `400` que identifique el campo. Un cuerpo que no sea objeto o la ausencia de parámetros obligatorios SHALL producir `400` antes de calcular.

#### Scenario: Valuar una opción válida
- **WHEN** se envía un objeto con precios, tiempo y volatilidad positivos y una tasa finita
- **THEN** se responde `200` con el precio teórico y las cinco griegas del contrato existente

#### Scenario: Rechazar un cuerpo o campo inválido
- **WHEN** se envía un arreglo, un objeto vacío o un parámetro con un tipo no admitido, no finito o fuera de su dominio
- **THEN** se responde `400` con el formato habitual de errores y un mensaje que identifica el cuerpo o parámetro inválido

#### Scenario: Admitir una tasa cero o negativa
- **WHEN** los demás parámetros son válidos y `riskFreeRate` es cero o un número negativo finito
- **THEN** la solicitud sigue siendo válida y devuelve `200`

### Requirement: Tipo de opción seguro

El endpoint SHALL admitir `CALL` y `PUT` sin distinguir mayúsculas y minúsculas. Si `optionType` se proporciona con un tipo distinto de cadena o con otro valor, SHALL responder `400` identificando el campo.

#### Scenario: Normalizar una opción en minúsculas
- **WHEN** se envía `optionType: "call"` o `optionType: "put"` con parámetros válidos
- **THEN** se devuelve `200` y `optionType` normalizado a mayúsculas

#### Scenario: Rechazar una opción nula o desconocida
- **WHEN** se envía `optionType: null`, un tipo no textual o una cadena diferente de CALL/PUT
- **THEN** se devuelve `400` en lugar de una excepción interna

### Requirement: Compatibilidad de solicitudes existentes

El endpoint SHALL conservar las rutas, la estructura de respuesta exitosa, el mensaje, la precisión y los resultados para las solicitudes válidas existentes. Al omitirlos, SHALL conservar `volatility: 0.2`, `riskFreeRate: 0.045` y `optionType: "PUT"`. Los campos adicionales SHALL conservar su tolerancia actual. Las solicitudes SHALL respetar el prefijo `API_URL` configurado.

#### Scenario: Utilizar valores predeterminados
- **WHEN** se envían únicamente `spotPrice: 100`, `strikePrice: 100` y `timeToExpirationYears: 1`
- **THEN** se devuelve `200`, los valores predeterminados actuales y `theoreticalPrice: 5.7858`

#### Scenario: Conservar cadenas numéricas y campos adicionales
- **WHEN** se envían los parámetros como cadenas numéricas junto con metadatos adicionales
- **THEN** la respuesta coincide con la solicitud numérica equivalente y los metadatos no alteran el cálculo

#### Scenario: Usar otro prefijo de API
- **WHEN** se configura un prefijo distinto de `/api/v1`
- **THEN** la validación y el cálculo están disponibles en ese prefijo sin modificar el cliente

### Requirement: Resultados numéricos utilizables

Una respuesta exitosa SHALL contener un precio teórico y cinco griegas finitos. Si los parámetros recibidos ocasionan resultados numéricos no representables, el endpoint SHALL responder `400` con un mensaje comprensible en lugar de devolver cálculos `null`.

#### Scenario: Valores que exceden la capacidad numérica
- **WHEN** se envían precios y tiempo positivos con una tasa finita que produce desbordamiento en el cálculo, como `riskFreeRate: -1e308`
- **THEN** se devuelve `400` explicando que los parámetros exceden el rango numérico admitido

### Requirement: Alcance y trazabilidad del cambio

La entrega SHALL identificar el endpoint mejorado, la participación de IA, la existencia o ausencia de optimización manual y la comparación de estructura y comportamiento antes/después con verificaciones reproducibles. La especificación SHALL permitir una estructura propia si la existente no es adecuada para cumplir este contrato, justificándola en el diseño y limitándola al endpoint. El cambio SHALL conservar los contratos de sesión y volatilidad implícita y los cálculos usados por las estrategias de cobertura.

#### Scenario: Revisar la evidencia del desarrollo
- **WHEN** se consulta la documentación de esta mejora
- **THEN** se encuentran la versión de referencia, los artefactos OpenSpec, los archivos modificados, las pruebas y una atribución que distingue trabajo asistido por IA de trabajo manual acreditado

#### Scenario: Comprobar la compatibilidad de otros flujos
- **WHEN** se ejecutan las pruebas de sesión y de volatilidad implícita y se compara el servicio cuantitativo con la referencia
- **THEN** se conservan sus respuestas y las fórmulas compartidas permanecen sin cambios
