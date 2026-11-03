import requests
import json

ALPACA_KEY = 'PK4V5IGAOIZNH2XKBQYF6DW2XJ'
ALPACA_SECRET = '5tTmeXfiEFdMWRZkbkXCi53VsCKFvitrrgAmajxteUcB'
ALPACA_BASE = 'https://paper-api.alpaca.markets'
headers = {
    'APCA-API-KEY-ID': ALPACA_KEY,
    'APCA-API-SECRET-KEY': ALPACA_SECRET
}

def inspect_and_clean():
    print("=" * 65)
    print("ESTADO INICIAL DE LA CUENTA EN ALPACA MARKETS")
    print("=" * 65)
    acc = requests.get(f"{ALPACA_BASE}/v2/account", headers=headers).json()
    cash_before = float(acc.get('cash', 0))
    bp_before = float(acc.get('buying_power', 0))
    pv_before = float(acc.get('portfolio_value', 0))
    print(f"Efectivo (Cash):       ${cash_before:,.2f} USD")
    print(f"Poder de Compra (BP):  ${bp_before:,.2f} USD")
    print(f"Valor del Portafolio:  ${pv_before:,.2f} USD")

    # Órdenes abiertas (no filleadas por límite fuera de mercado)
    orders = requests.get(f"{ALPACA_BASE}/v2/orders?status=open", headers=headers).json()
    print(f"\nÓrdenes abiertas pendientes de ejecución: {len(orders)}")
    for o in orders:
        oid = o.get('id')
        sym = o.get('symbol')
        side = o.get('side').upper()
        qty = o.get('qty')
        lp = o.get('limit_price')
        st = o.get('status')
        print(f"  -> [{side}] {sym} x {qty} @ Limit ${lp} (ID: {oid}, Estado: {st})")

    if not orders:
        print("\nNo hay órdenes pendientes por cancelar.")
        return

    print("\n" + "=" * 65)
    print("CANCELANDO TODAS LAS ÓRDENES ABIERTAS CON LÍMITE PENDIENTE...")
    print("=" * 65)
    
    # Alpaca cancel all orders endpoint: DELETE /v2/orders
    del_res = requests.delete(f"{ALPACA_BASE}/v2/orders", headers=headers)
    print(f"Respuesta de cancelación (HTTP {del_res.status_code}):")
    try:
        del_data = del_res.json()
        for item in del_data:
            print(f"  [OK] Orden {item.get('id')} -> HTTP {item.get('status')}")
    except Exception:
        print("  [OK] Procesado:", del_res.text)

    # Verificar estado después de la cancelación
    print("\n" + "=" * 65)
    print("ESTADO FINAL DE LA CUENTA EN ALPACA MARKETS")
    print("=" * 65)
    acc_after = requests.get(f"{ALPACA_BASE}/v2/account", headers=headers).json()
    cash_after = float(acc_after.get('cash', 0))
    bp_after = float(acc_after.get('buying_power', 0))
    pv_after = float(acc_after.get('portfolio_value', 0))
    print(f"Efectivo (Cash):       ${cash_after:,.2f} USD")
    print(f"Poder de Compra (BP):  ${bp_after:,.2f} USD")
    print(f"Valor del Portafolio:  ${pv_after:,.2f} USD")
    print(f"Incremento de Poder de Compra: +${(bp_after - bp_before):,.2f} USD")

    # Posiciones abiertas actuales
    pos = requests.get(f"{ALPACA_BASE}/v2/positions", headers=headers).json()
    print(f"\nPosiciones en cartera activas: {len(pos)}")
    for p in pos:
        psym = p.get('symbol')
        pqty = p.get('qty')
        pcost = float(p.get('cost_basis', 0))
        pmkt = float(p.get('market_value', 0))
        print(f"  * {psym}: {pqty} unidades | Costo: ${pcost:,.2f} | Valor Mercado: ${pmkt:,.2f}")

if __name__ == "__main__":
    inspect_and_clean()
