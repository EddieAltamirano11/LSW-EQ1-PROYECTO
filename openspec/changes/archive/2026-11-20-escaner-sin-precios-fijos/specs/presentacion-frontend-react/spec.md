# Spec Delta

## ADDED Requirements

### Requirement: Identificación de valores teóricos del escáner

El ranking, la boleta y el modal de respuesta SHALL identificar como teóricas (Black-Scholes) las primas, métricas y probabilidades que provienen del escáner, y SHALL NOT presentarlas como cotizaciones de mercado.

#### Scenario: Prima teórica en el ranking
- **WHEN** el ranking muestra las primas de Put y Call de un candidato con valores del escáner
- **THEN** las primas aparecen rotuladas como teóricas

#### Scenario: Prima teórica en el modal de respuesta
- **WHEN** el modal de respuesta muestra una prima que proviene del escáner
- **THEN** la prima aparece rotulada como teórica
