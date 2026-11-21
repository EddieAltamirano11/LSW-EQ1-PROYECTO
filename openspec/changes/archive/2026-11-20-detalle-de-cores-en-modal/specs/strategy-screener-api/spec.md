# Spec Delta

## ADDED Requirements

### Requirement: Participación de cada core en el resultado

Para cada empresa, cada core SHALL informar su `role`:

| `role` | Significado |
|---|---|
| `CONFLUENCE` | El core está seleccionado y su puntaje entra a la confluencia |
| `GATE` | Se calculó como filtro de elegibilidad, sin ponderar: Fundamental cuando no está seleccionado (veto de viabilidad) y Estrategia `004` |
| `DEPENDENCY` | Se calculó solo porque lo requiere otro core seleccionado, como Técnico cuando únicamente está seleccionado Señales directas |
| `SYNTHESIS` | Confluencia `007` |
| `NOT_COMPUTED` | No se calculó |

Con `role: CONFLUENCE`, el core SHALL incluir `effectiveWeight` igual al peso normalizado que aplicó la confluencia.

#### Scenario: Core seleccionado
- **GIVEN** están seleccionados los cores 001, 002, 003, 005 y 006
- **WHEN** se evalúa una empresa
- **THEN** el core 001 tiene `role: CONFLUENCE` y `effectiveWeight: 0.225`

#### Scenario: Técnico como dependencia
- **GIVEN** solo está seleccionado el core 003
- **WHEN** se evalúa una empresa
- **THEN** el core 001 tiene `role: DEPENDENCY` y no incluye `effectiveWeight`

#### Scenario: Fundamental como filtro
- **GIVEN** el core 002 no está seleccionado
- **WHEN** se evalúa una empresa
- **THEN** el core 002 tiene `role: GATE`

#### Scenario: Core no calculado
- **GIVEN** el core 005 no está seleccionado
- **WHEN** se evalúa una empresa
- **THEN** el core 005 tiene `role: NOT_COMPUTED`
