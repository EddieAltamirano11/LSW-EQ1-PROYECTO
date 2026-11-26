# Evidencia de implementación PWA

## Antes y después

- Antes, la entrada de React tenía un favicon embebido y Vite emitía rutas de recursos absolutas. El cliente carecía de un manifiesto y de iconos de instalación.
- El HTML enlaza el manifiesto y el icono táctil. El manifiesto define la identidad, la ventana independiente y el arranque relativo. Vite genera un build cuyos recursos se resuelven en `/` y en `/dashboard/`.

## Verificaciones ejecutadas

| Verificación | Resultado |
| --- | --- |
| Windows y System.Drawing | Cuatro PNG verificados en 192 × 192, 512 × 512, 512 × 512 adaptable y 180 × 180. El icono adaptable es opaco. El símbolo queda dentro del círculo de seguridad de radio equivalente al 40 % del ancho. |
| `npm --prefix client run build` y `npm --prefix client run preview` | Build exitoso con Vite 6.4.6. La vista previa y Express entregaron el HTML, manifiesto, PNG, JS y CSS con los tipos esperados. El `GET /dashboard` redirigió a `/dashboard/`. |
| Wrangler 4.168.0 con `pages dev --local-protocol=https` | La raíz, el manifiesto y los cuatro iconos respondieron `200` con sus tipos correctos. Por decisión del usuario, la prueba de Pages se realizó localmente. |
| Verificación de rutas HTTP | Express conservó `/`, `/login`, los descriptores y `spec.json` de API v1 y v2. La URL directa configurada en Render devolvió `200` JSON en `/api/v2/health`. |
| `npm --prefix client run test` | 82 pruebas aprobadas en 16 archivos. |
| `node --test test/login.routes.test.js test/login.session.test.js` | Las 10 pruebas aprobaron al repetirlas con acceso a loopback. |
| Chrome for Testing 158.0.8127.88 en Windows | DevTools reportó cero errores de instalabilidad. Chrome registró y arrancó Los Eddies desde `/dashboard/` en modo `standalone`. En la aplicación instalada se verificaron acceso sin sesión previa, login, navegación entre Dashboard y Portafolio y `GET /api/v1/auth/session` con `200`. |
| Reconexión en Chrome instalado | Se bloqueó una consulta de mercado y los tres `POST` de orden antes de la red. Las dos coberturas mostraron el aviso de resultado desconocido. Cada orden se intentó una sola vez tras desconectar y reconectar el navegador. Las vistas previas se habilitaron con el fixture ya existente del cliente, aislado en la prueba. |
| Edge 158.0.4370.33 en Windows | Cargó React y leyó el manifiesto en ambas bases. DevTools reportó cero errores de instalabilidad y registró la app en un perfil temporal. La automatización agotó el tiempo de espera al abrir la ventana independiente. |

Wrangler rechazó las dos reglas preexistentes de `client/public/_redirects`. Sirvió los recursos estáticos correctamente con su fallback nativo. Una consulta a `/api/v2/health` en el origen emulado devolvió HTML, mientras el destino de Render que usa el cliente respondió JSON.

El usuario confirmó que completó la apertura en ventana independiente desde Edge y las pruebas de instalación en Chrome para Android y Safari para iPhone. Su confirmación completa la matriz de aceptación de la tarea 3.1.

## Atribución

Codex realizó la implementación asistida por IA, la conversión del favicon institucional y las verificaciones automatizadas con PowerShell, Node.js, Wrangler y DevTools. El usuario realizó las pruebas de aceptación indicadas en su confirmación. La autoría del favicon previo carece de registro en esta evidencia.
