# Spec Delta

## Purpose

Estructurar, previsualizar y emitir Auto-Collar y Protective Put con contratos listados y cotizaciones observadas, y registrar exactamente lo que quedó en el broker.

## ADDED Requirements

### Requirement: Cadena de opciones con cotizaciones observadas

Estos flujos SHALL usar únicamente contratos listados del subyacente con cotizaciones observadas:

- `GET /api/v1/broker/options-chain/:symbol`;
- `GET /api/v1/hedging/recommend-option/:symbol[/:type]` y su alias `recommend-collar`;
- Auto-Collar y Protective Put.

Cada contrato SHALL incluir símbolo OCC, tipo, strike, vencimiento, multiplicador, `bid`, `ask`, volumen, interés abierto, instante de la cotización, retraso conocido y fuente.

- Las cotizaciones con más de 15 minutos de retraso o fuera de la sesión analizada SHALL descartarse.
- El sistema SHALL NOT generar strikes ni primas.
- Si no hay contratos cotizados para la solicitud, SHALL responder `503` con la causa.

#### Scenario: Consultar la cadena
- **WHEN** se consulta la cadena de un símbolo y los proveedores están disponibles
- **THEN** cada contrato devuelto existe en la lista del proveedor y trae su cotización, instante, retraso y fuente

#### Scenario: Proveedor de opciones indisponible
- **WHEN** el proveedor de cotizaciones de opciones no responde, para cualquiera de los brokers
- **THEN** la API responde `503` y no devuelve contratos ni primas calculadas por el sistema

### Requirement: Vista previa de la cobertura sin emitir órdenes

`POST /api/v1/hedging/auto-collar` con `executeOrders: false` y `GET /api/v1/hedging/recommend-option/:symbol/PUT` SHALL devolver:

- los contratos que se usarían;
- sus cotizaciones con instante y fuente;
- las métricas calculadas con esas cotizaciones.

En el Auto-Collar, los contratos SHALL ser los que selecciona el Core 004 sobre la cadena real. Ambas consultas SHALL hacerse sin enviar órdenes ni guardar registros.

#### Scenario: Previsualizar un Auto-Collar
- **WHEN** se solicita el Auto-Collar de AAPL con `executeOrders: false`
- **THEN** la respuesta incluye el Put y el Call que selecciona el Core 004, con sus cotizaciones y métricas, y no se crea ninguna orden ni estrategia

#### Scenario: Previsualizar un Protective Put
- **WHEN** se consulta `recommend-option` de AAPL con tipo `PUT`
- **THEN** la respuesta incluye un contrato Put listado con su `ask` observado, instante y fuente
