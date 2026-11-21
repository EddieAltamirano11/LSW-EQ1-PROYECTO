# Spec Delta

## ADDED Requirements

### Requirement: Serie técnica para gráficas

`GET /api/v2/strategy-screener/technical/:symbol` SHALL requerir sesión y SHALL devolver, para el símbolo:

- las velas diarias cerradas de los dos años que usa el Core 001;
- sus niveles de soporte y resistencia, los tramos de tendencia, las medias móviles y la proyección vigente;
- la fuente y el instante de corte.

SHALL ser de solo lectura y responder así en los casos de error:

| Situación | Respuesta |
|---|---|
| Sin sesión válida | `401` |
| Símbolo inválido | `400` |
| La fuente no entrega datos | `503` con la causa, sin datos supuestos |

#### Scenario: Serie de una empresa
- **GIVEN** una sesión válida
- **WHEN** se consulta la serie técnica de AAPL
- **THEN** la respuesta incluye las velas diarias de dos años con los niveles, tramos, medias y proyección del Core 001, su fuente y su instante de corte

#### Scenario: Sin sesión
- **WHEN** se consulta la serie técnica sin token
- **THEN** la API responde `401`

#### Scenario: Fuente sin datos
- **WHEN** Alpaca no entrega las velas del símbolo
- **THEN** la API responde `503` con la causa
