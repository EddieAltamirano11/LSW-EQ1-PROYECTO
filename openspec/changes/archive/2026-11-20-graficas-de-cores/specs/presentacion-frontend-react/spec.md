# Spec Delta

## ADDED Requirements

### Requirement: Gráficas de los cores en la consulta por core

La consulta de Técnico (`001`), Estrategia (`004`) y Confluencia (`007`) SHALL incluir una pestaña de gráfica para la empresa seleccionada en su tabla:

- **`001`**: velas de dos años con bandas de soporte y resistencia, tramos de tendencia, medias móviles y la ventana proyectada, rotulada como proyección.
- **`004`**: ganancia o pérdida del collar al vencimiento según el precio del subyacente, con strikes, punto de equilibrio, pérdida máxima y ganancia máxima.
- **`007`**: contribución de cada core al puntaje (peso efectivo por puntaje) y los conflictos.

Cada gráfica SHALL tener un resumen en texto accesible. Si faltan datos, SHALL mostrar la causa en lugar de una gráfica vacía o con valores supuestos. Las gráficas SHALL cargarse solo al abrir su pestaña.

#### Scenario: Gráfica técnica
- **GIVEN** se evaluaron los cores
- **WHEN** el usuario abre la pestaña Gráfica de Técnico con AAPL seleccionada
- **THEN** ve las velas de dos años con niveles, tramos y la ventana proyectada rotulada como proyección

#### Scenario: Payoff del collar
- **GIVEN** el Core 004 tiene un collar para AAPL
- **WHEN** el usuario abre la gráfica de Estrategia
- **THEN** ve el payoff con strikes, breakeven, pérdida máxima y ganancia máxima, y esos valores coinciden con la tabla

#### Scenario: Contribución a la confluencia
- **GIVEN** la confluencia de AAPL usó cinco cores
- **WHEN** el usuario abre la gráfica de Confluencia
- **THEN** ve la contribución de cada core, y la suma de las contribuciones coincide con el puntaje

#### Scenario: Sin datos para la gráfica
- **WHEN** el Core 001 no tiene datos para la empresa seleccionada
- **THEN** la pestaña muestra la causa

### Requirement: Vista técnica en la columna central

La columna central SHALL ofrecer un selector entre «TradingView» y «Core técnico».

- **TradingView** SHALL ser la vista por defecto y conservar su comportamiento actual.
- **Core técnico** SHALL mostrar, para el activo seleccionado, la gráfica del Core 001: velas diarias de dos años, bandas de soporte y resistencia, tramos de tendencia, medias móviles y la ventana proyectada, rotulada como proyección. SHALL incluir un resumen en texto accesible.
- Esta vista SHALL NOT requerir que se hayan evaluado los cores.
- Al cambiar el activo seleccionado, la vista SHALL actualizarse a ese activo.
- Si faltan datos del Core 001, SHALL mostrar la causa y permitir volver a TradingView.

#### Scenario: Vista por defecto
- **WHEN** se abre el panel
- **THEN** la columna central muestra TradingView como hasta ahora

#### Scenario: Cambiar a la vista Core técnico
- **GIVEN** AAPL es el activo seleccionado
- **WHEN** el usuario elige «Core técnico»
- **THEN** ve las velas de AAPL con soportes, resistencias, tramos de tendencia y la ventana proyectada

#### Scenario: Cambiar de activo con la vista técnica abierta
- **GIVEN** la columna central muestra la vista Core técnico
- **WHEN** el usuario selecciona MSFT en el ranking
- **THEN** la gráfica pasa a mostrar MSFT

#### Scenario: Sin datos del Core 001
- **WHEN** el Core 001 no tiene datos del activo seleccionado
- **THEN** la vista muestra la causa y permite volver a TradingView
