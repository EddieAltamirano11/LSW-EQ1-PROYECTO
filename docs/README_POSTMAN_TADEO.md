# Colección Postman — Vertical Slice de Tadeo

Archivos:

- `TADEO_CORE.postman_collection.json` → 16 requests en 4 carpetas.
- `TADEO_CORE.postman_environment.json` → `baseUrl` y `databaseTarget`.

## Importar

1. Abre Postman.
2. **Import** → **File** → selecciona `TADEO_CORE.postman_collection.json`.
3. **Import** → **File** → selecciona `TADEO_CORE.postman_environment.json`.
4. Arriba a la derecha, selecciona el environment **“TADEO · Render/Local”**.

## Configurar

En el environment o en las variables de la colección:

| Variable | Valor | Nota |
|---|---|---|
| `baseUrl` | `https://lsw-eq1-proyecto.onrender.com` | O `http://localhost:3050` |
| `databaseTarget` | `supabase` o `mongodb` | Debe coincidir con el frontend |
| `strategyId` | UUID / `STRAT-...` | 00.3 lo captura automáticamente |
| `legId` | `LEG-...` | 01.1 o 01.3 lo capturan automáticamente |

> En Supabase, `strategyId` debe ser un UUID. En MongoDB puede ser un id tipo
> `STRAT-COLLAR-...` o el `portfolioId`.

## Orden de ejecución (demo de 6 minutos)

```
00.1 Health v2
00.3 Listar estrategias        ← guarda strategyId
01.1 Listar patas              ← guarda legId si hace falta
01.2 Pata individual
01.3 Crear pata                ← guarda el legId generado
02.1 Métricas financieras
02.2 Recalcular métricas
02.3 Matriz de Payoff
01.5 Eliminar pata             ← limpia la pata de prueba
```

Extras: `00.2` (login opcional), `00.4` (documento completo), `01.4` (update),
`01.6` (lote), `03.1`–`03.3` (underlying y estado).

## Ejecutar sin abrir Postman (Newman)

```bash
npx --yes newman run docs/TADEO_CORE.postman_collection.json \
  -e docs/TADEO_CORE.postman_environment.json \
  --folder "00 · Preparación"
```

## Advertencias

- `01.3` crea una pata real en la BD; `01.5` la elimina. No ejecutes `01.3` sobre
  una estrategia que no quieras tocar.
- `02.2` recalcula y persiste `netDelta`, `netDebitCredit` y `floorProtectionPrice`.
  El body `currentSpotPrice` se acepta, pero el código actual **no** reprecía con
  Black-Scholes.
- `02.3` con `steps=25` devuelve **26 puntos** (25 intervalos, extremos inclusivos).
- `01.6` bajo `/hedging` exige **arreglo crudo**, no `{ "legs": [] }`.
