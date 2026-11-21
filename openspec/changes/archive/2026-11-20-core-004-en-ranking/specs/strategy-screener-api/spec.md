# Spec Delta

## ADDED Requirements

### Requirement: Tipo de exclusión por empresa

Cada empresa en `excluded` SHALL incluir, además de su motivo, `exclusionType` con uno de estos valores:

| Valor | Cuándo |
|---|---|
| `VIABILITY_VETO` | La empresa quedó clasificada como `MARGINAL` o `NO_VIABLE` |
| `NO_COLLAR` | El Core 004 no encontró un par Put/Call líquido y compatible |
| `INSUFFICIENT_DATA` | Faltaron datos de la elegibilidad, de la cadena o de un core seleccionado |

#### Scenario: Veto de viabilidad
- **GIVEN** una empresa clasificada como `MARGINAL`
- **WHEN** se evalúan los cores
- **THEN** la empresa aparece en `excluded` con `exclusionType: VIABILITY_VETO` y su motivo

#### Scenario: Sin collar líquido
- **GIVEN** una empresa viable sin un par Put/Call apto
- **WHEN** se evalúan los cores
- **THEN** la empresa aparece en `excluded` con `exclusionType: NO_COLLAR`

#### Scenario: Datos insuficientes
- **GIVEN** una empresa a la que le falta el puntaje de un core seleccionado
- **WHEN** se evalúan los cores
- **THEN** la empresa aparece en `excluded` con `exclusionType: INSUFFICIENT_DATA`
