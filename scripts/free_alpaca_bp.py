import requests
import json

ALPACA_KEY = 'PK4V5IGAOIZNH2XKBQYF6DW2XJ'
ALPACA_SECRET = '5tTmeXfiEFdMWRZkbkXCi53VsCKFvitrrgAmajxteUcB'
ALPACA_BASE = 'https://paper-api.alpaca.markets'
headers = {
    'APCA-API-KEY-ID': ALPACA_KEY,
    'APCA-API-SECRET-KEY': ALPACA_SECRET
}

def free_buying_power():
    print("=" * 65)
    print("ESTADO ANTES DE LIBERAR BUYING POWER")
    print("=" * 65)
    acc = requests.get(f"{ALPACA_BASE}/v2/account", headers=headers).json()
    cash_before = float(acc.get('cash', 0))
    bp_before = float(acc.get('buying_power', 0))
    pv_before = float(acc.get('portfolio_value', 0))
    print(f"Efectivo (Cash):       ${cash_before:,.2f} USD")
    print(f"Poder de Compra (BP):  ${bp_before:,.2f} USD")
    print(f"Valor del Portafolio:  ${pv_before:,.2f} USD")

    # 1. Cancelar todas las órdenes abiertas
    print("\n1. Cancelando ordenes abiertas...")
    del_orders = requests.delete(f"{ALPACA_BASE}/v2/orders", headers=headers)
    print(f"   Respuesta ordenes: HTTP {del_orders.status_code}")

    # 2. Liquidar todas las posiciones abiertas
    print("\n2. Liquidando todas las posiciones abiertas (acciones y opciones)...")
    del_pos = requests.delete(f"{ALPACA_BASE}/v2/positions?cancel_orders=true", headers=headers)
    print(f"   Respuesta liquidacion: HTTP {del_pos.status_code}")
    try:
        data = del_pos.json()
        if isinstance(data, list):
            for item in data:
                print(f"   [OK] Liquidada posicion: {item.get('symbol')} -> HTTP {item.get('status')}")
    except Exception:
        pass

    # 3. Consultar estado final
    print("\n" + "=" * 65)
    print("ESTADO FINAL DESPUES DE LIBERAR BUYING POWER")
    print("=" * 65)
    acc_after = requests.get(f"{ALPACA_BASE}/v2/account", headers=headers).json()
    cash_after = float(acc_after.get('cash', 0))
    bp_after = float(acc_after.get('buying_power', 0))
    pv_after = float(acc_after.get('portfolio_value', 0))
    print(f"Efectivo (Cash):       ${cash_after:,.2f} USD")
    print(f"Poder de Compra (BP):  ${bp_after:,.2f} USD")
    print(f"Valor del Portafolio:  ${pv_after:,.2f} USD")
    print(f"Aumento de Buying Power: +${(bp_after - bp_before):,.2f} USD")

if __name__ == "__main__":
    free_buying_power()

