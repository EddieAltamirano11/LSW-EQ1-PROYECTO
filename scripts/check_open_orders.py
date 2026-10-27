import os
import sys
import json
import requests
import subprocess
ALPACA_KEY = 'PK4V5IGAOIZNH2XKBQYF6DW2XJ'
ALPACA_SECRET = '5tTmeXfiEFdMWRZkbkXCi53VsCKFvitrrgAmajxteUcB'
ALPACA_BASE = 'https://paper-api.alpaca.markets'

def check_alpaca():
    print("=" * 70)
    print("--- 1. ALPACA PAPER ACCOUNT & ORDERS ---")
    headers = {
        'APCA-API-KEY-ID': ALPACA_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET
    }
    acc_res = requests.get(f"{ALPACA_BASE}/v2/account", headers=headers)
    acc = acc_res.json()
    print(f"Alpaca Cash: ${float(acc.get('cash', 0)):,.2f} | Buying Power: ${float(acc.get('buying_power', 0)):,.2f}")
    
    ord_res = requests.get(f"{ALPACA_BASE}/v2/orders?status=open", headers=headers)
    orders = ord_res.json()
    if isinstance(orders, list):
        print(f"Alpaca Open Orders Count: {len(orders)}")
        for o in orders:
            oid = o.get('id')
            sym = o.get('symbol')
            side = o.get('side')
            qty = o.get('qty')
            otype = o.get('type')
            lp = o.get('limit_price')
            st = o.get('status')
            print(f"  [ALPACA] ID: {oid} | Symbol: {sym} | Side: {side} | Qty: {qty} | Type: {otype} | Limit: {lp} | Status: {st}")
        return orders
    else:
        print("Alpaca returned error:", orders)
        return []

def check_webull():
    print("=" * 70)
    print("--- 2. WEBULL PAPER SANDBOX ACCOUNT & ORDERS ---")
    p_acc = subprocess.run(['python', 'scripts/webull_desktop_bridge.py', 'account'], capture_output=True, text=True)
    try:
        acc_data = json.loads(p_acc.stdout)
        print(f"Webull Cash: ${float(acc_data.get('cash', 0)):,.2f} | Buying Power: ${float(acc_data.get('buyingPower', 0)):,.2f}")
    except Exception as e:
        print("Error parsing Webull account:", e, p_acc.stdout)

    p_ord = subprocess.run(['python', 'scripts/webull_desktop_bridge.py', 'orders'], capture_output=True, text=True)
    try:
        ord_data = json.loads(p_ord.stdout)
        all_orders = ord_data.get('orders', [])
        open_orders = [o for o in all_orders if o.get('status') in ['SUBMITTED', 'submitted', 'new', 'PENDING']]
        print(f"Webull Pending/Submitted Orders Count: {len(open_orders)}")
        for o in open_orders:
            oid = o.get('order_id') or o.get('id')
            sym = o.get('symbol')
            side = o.get('side')
            qty = o.get('total_quantity') or o.get('quantity')
            lp = o.get('limit_price') or o.get('limitPrice')
            strat = o.get('option_strategy', 'STOCK')
            print(f"  [WEBULL] ID: {oid} | Symbol: {sym} | Strat: {strat} | Side: {side} | Qty: {qty} | Limit: {lp} | Status: {o.get('status')}")
        return open_orders
    except Exception as e:
        print("Error parsing Webull orders:", e, p_ord.stdout)
        return []

if __name__ == "__main__":
    check_alpaca()
    check_webull()
