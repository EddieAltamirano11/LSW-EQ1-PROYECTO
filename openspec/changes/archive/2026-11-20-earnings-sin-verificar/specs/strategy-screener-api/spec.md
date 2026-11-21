# Spec Delta

## ADDED Requirements

### Requirement: Riesgo de eventos sin verificar

Cuando el calendario de resultados no responda o no entregue una fecha utilizable, la API SHALL NOT estimar ni inventar una fecha, ni atribuir evidencia al proveedor. En su lugar:

- SHALL informar el riesgo de eventos como `UNVERIFIED`, con la causa y la fuente consultada.
- La falta de fecha SHALL NOT retirar la posición del activo cuando la elegibilidad y los cores seleccionados tengan datos suficientes.
- Fundamental (`002`) SHALL calcular su puntaje sin el componente de eventos e indicar que el riesgo no está verificado.
- Señales directas (`003`) SHALL abstenerse con la señal `HOLD` y la regla `EVENT_UNVERIFIED`.
- El activo y la respuesta SHALL marcarse como parciales.

#### Scenario: Calendario indisponible para un activo
- **WHEN** Webull no responde a la consulta del calendario de resultados de AAPL y el resto de sus datos está disponible
- **THEN** AAPL conserva su posición, su riesgo de eventos es `UNVERIFIED` con la causa, `003` devuelve `HOLD` con `EVENT_UNVERIFIED` y la respuesta es `200` con estado parcial

#### Scenario: Calendario con fecha verificable
- **WHEN** el calendario entrega una fecha de resultados dentro de la ventana válida
- **THEN** el riesgo se clasifica como `HIGH`, `MEDIUM` o `LOW`, con la evidencia de esa fuente

#### Scenario: Sin fechas estimadas
- **WHEN** el calendario falla
- **THEN** la respuesta no contiene fechas de resultados ni evidencia atribuida al calendario
