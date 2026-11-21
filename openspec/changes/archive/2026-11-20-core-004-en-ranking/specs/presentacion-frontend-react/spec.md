# Spec Delta

## ADDED Requirements

### Requirement: Collar del Core 004 en el ranking

Cuando exista resultado de cores, el ranking SHALL mostrar en las columnas de Put, Call, Prima Neta y Retorno Máx. el collar del Core 004 de cada empresa apta:

- strike y vencimiento de cada contrato;
- prima observada de cada contrato;
- costo neto expresado como débito o crédito;
- retorno máximo;
- la marca «Real · Core 004» y la hora de cotización.

Sin resultado de cores, o en filas sin collar del Core 004, esas columnas SHALL mostrar los valores del escáner identificados como teóricos. En las filas con collar real, la columna de probabilidad SHALL indicar que la probabilidad teórica no aplica a ese collar. La columna de cores SHALL distinguir el veto de viabilidad, la falta de collar líquido y los datos insuficientes, y mostrar la causa. El ranking SHALL conservar sus columnas actuales.

#### Scenario: Empresa con collar real
- **GIVEN** se evaluaron los cores y AAPL tiene collar del Core 004
- **WHEN** se muestra el ranking
- **THEN** la fila de AAPL muestra los contratos, primas, costo neto y retorno del Core 004 con la marca «Real · Core 004», y su probabilidad indica que no aplica

#### Scenario: Antes de evaluar los cores
- **WHEN** el ranking se muestra sin resultado de cores
- **THEN** las columnas de collar muestran los valores del escáner identificados como teóricos

#### Scenario: Empresa excluida sin collar
- **GIVEN** una empresa excluida por falta de collar líquido
- **WHEN** se muestra el ranking
- **THEN** la columna de cores indica «Sin collar líquido» con la causa, no un veto
