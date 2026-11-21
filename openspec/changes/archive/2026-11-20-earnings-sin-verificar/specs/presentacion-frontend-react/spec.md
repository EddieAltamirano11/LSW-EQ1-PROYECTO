# Spec Delta

## ADDED Requirements

### Requirement: Riesgo de earnings sin verificar en la consulta por core

Cuando la API informe el riesgo de eventos como `UNVERIFIED`, la consulta por core de Fundamental (`002`) y de Señales directas (`003`) SHALL mostrar «Earnings sin verificar» junto con la causa, y SHALL NOT mostrar una fecha de resultados.

#### Scenario: Riesgo de earnings sin verificar
- **GIVEN** la API de cores devuelve el riesgo de eventos `UNVERIFIED` para AAPL
- **WHEN** el usuario abre la consulta de Fundamental
- **THEN** la fila de AAPL muestra «Earnings sin verificar» con la causa y sin fecha de resultados
