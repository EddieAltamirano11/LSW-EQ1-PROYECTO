# Propuesta

## Why

El acceso y el panel de React usan una interfaz oscura que difiere del estilo claro y verde de la pantalla pública de acceso. Unificar la presentación permite reconocer el mismo sistema y usar sus controles con comodidad en escritorio y móvil.

## What Changes

- Aplicar la paleta verde bosque, los fondos claros y la marca Los Eddies a las pantallas React, siguiendo el login público y la maqueta como referencias visuales.
- Reorganizar formularios, filtros, tablas y modales para que sus controles sigan visibles, legibles y accesibles por teclado en pantallas estrechas.
- Aplicar el estilo a las dos vistas de sesión, al escáner y ranking, a los contenedores de TradingView, al selector y avisos de órdenes y a los modales de criterios y respuesta del broker.
- Conservar los controles, condiciones de visibilidad, valores por defecto, validaciones, estados y acciones existentes. El código vigente prevalece sobre los datos y flujos ilustrativos de la maqueta.

## Capabilities

### New Capabilities

- `presentacion-frontend-react` cubre la identidad visual y la adaptación a pantallas estrechas de la interfaz React, con criterios para conservar sus controles y flujos.

### Modified Capabilities

## Impact

- El alcance de implementación se limita a la presentación en `client/src`. `public/login` sirve de referencia visual. La especificación vigente `inicio-sesion` corresponde al acceso público en `/login`, que es una pantalla distinta.
- No hay endpoints afectados. Se conservan los contratos consumidos por React para `POST /api/v2/auth/login`, `POST /api/v1/auth/login`, `GET /api/v2/market/scanner/top-collars` y `POST /api/v2/hedging/auto-collar` con su respaldo en `POST /api/v1/hedging/auto-collar`. El rediseño preserva las rutas y configuración de publicación, la persistencia de sesión y las integraciones actuales.
- La verificación se limita a revisión visual en escritorio y móvil, revisión del código y compilación del cliente. Quedan fuera la ejecución en ambos modos de órdenes y las pruebas con respuestas simuladas del broker o la base de datos.
- La evidencia de implementación identificará el antes y el después, quién realizó cada cambio, las herramientas utilizadas y las verificaciones efectivamente realizadas, distinguiendo la asistencia de IA del trabajo manual acreditado.
