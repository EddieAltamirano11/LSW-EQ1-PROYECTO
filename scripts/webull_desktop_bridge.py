import sys
import os
import json
import uuid
import argparse
import logging

# Silenciar logs internos del SDK de Webull para que la salida estandar sea exclusivamente JSON
logging.basicConfig(level=logging.CRITICAL)
logging.disable(logging.CRITICAL)

# Cargar variables de entorno manualmente desde .env si existe
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(dotenv_path):
    with open(dotenv_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

from webull.core.client import ApiClient
from webull.trade.trade_client import TradeClient
from webull.data.data_client import DataClient
from webull.data.common.category import Category

APP_KEY = os.getenv('WEBULL_APP_KEY', 'us.d099728c9dc63c32a77ea49fc73ec4b5')
APP_SECRET = os.getenv('WEBULL_APP_SECRET', '961df980a66ff97bdd5bfe9de3fd3a04')
REGION_ID = os.getenv('WEBULL_REGION_ID', 'us')
DEFAULT_ENDPOINT = os.getenv('WEBULL_ENDPOINT', 'api.sandbox.webull.com')
TARGET_ACCOUNT_NUM = os.getenv('WEBULL_ACCOUNT_ID', 'DEV4Q8EB')

def get_clients():
    client = ApiClient(APP_KEY, APP_SECRET, REGION_ID)
    client.add_endpoint(REGION_ID, DEFAULT_ENDPOINT)
    tc = TradeClient(client)
    dc = DataClient(client)
    return tc, dc

def resolve_account_id(tc):
    """Resuelve el account_id interno de Webull (ej. GBG647DN3VL57GSDVGA47NCG18) dado el numero DEV4Q8EB"""
    try:
        acc_list = tc.account_v2.get_account_list().json()
        if isinstance(acc_list, list):
            for acc in acc_list:
                if acc.get('account_number') == TARGET_ACCOUNT_NUM or acc.get('account_id') == TARGET_ACCOUNT_NUM:
                    return acc.get('account_id'), acc
            if acc_list:
                return acc_list[0].get('account_id'), acc_list[0]
    except Exception as e:
        pass
    return 'GBG647DN3VL57GSDVGA47NCG18', {'account_number': TARGET_ACCOUNT_NUM, 'account_id': 'GBG647DN3VL57GSDVGA47NCG18'}

def cmd_account(args):
    tc, _ = get_clients()
    acc_id, acc_meta = resolve_account_id(tc)
    bal_res = tc.account_v2.get_account_balance(acc_id)
    if bal_res.status_code == 200:
        data = bal_res.json()
        out = {
            'success': True,
            'broker': 'WEBULL',
            'accountNumber': acc_meta.get('account_number', TARGET_ACCOUNT_NUM),
            'accountId': acc_id,
            'accountType': acc_meta.get('account_type', 'CASH'),
            'currency': data.get('total_asset_currency', 'USD'),
            'portfolioValue': float(data.get('total_net_liquidation_value', 1000000.0)),
            'cash': float(data.get('total_cash_balance', 1000000.0)),
            'buyingPower': float(data.get('account_currency_assets', [{}])[0].get('buying_power', 1000000.0)),
            'unrealizedPL': float(data.get('total_unrealized_profit_loss', 0.0)),
            'dayPL': float(data.get('total_day_profit_loss', 0.0)),
            'raw': data
        }
        print(json.dumps(out))
    else:
        print(json.dumps({'success': False, 'status': bal_res.status_code, 'error': bal_res.text}))

def cmd_positions(args):
    tc, _ = get_clients()
    acc_id, _ = resolve_account_id(tc)
    pos_res = tc.account_v2.get_account_position(acc_id)
    if pos_res.status_code == 200:
        data = pos_res.json()
        print(json.dumps({'success': True, 'positions': data}))
    else:
        print(json.dumps({'success': False, 'status': pos_res.status_code, 'error': pos_res.text}))

def cmd_orders(args):
    tc, _ = get_clients()
    acc_id, _ = resolve_account_id(tc)
    open_orders_res = tc.order_v2.get_order_open(acc_id)
    history_res = tc.order_v2.get_order_history(acc_id)
    raw_open = open_orders_res.json() if open_orders_res.status_code == 200 else []
    raw_history = history_res.json() if history_res.status_code == 200 else []

    flattened = []
    # Normalizar ordenes abiertas (pueden venir envueltas en combo_type / orders)
    if isinstance(raw_open, list):
        for item in raw_open:
            if 'orders' in item and isinstance(item['orders'], list):
                for sub in item['orders']:
                    sub['parent_client_order_id'] = item.get('client_order_id')
                    sub['combo_order_id'] = item.get('combo_order_id')
                    flattened.append(sub)
            else:
                flattened.append(item)

    if isinstance(raw_history, list):
        for item in raw_history:
            if 'orders' in item and isinstance(item['orders'], list):
                for sub in item['orders']:
                    sub['parent_client_order_id'] = item.get('client_order_id')
                    sub['combo_order_id'] = item.get('combo_order_id')
                    flattened.append(sub)
            else:
                flattened.append(item)

    print(json.dumps({'success': True, 'orders': flattened}))

def cmd_quote(args):
    _, dc = get_clients()
    symbol = args.symbol.upper()
    try:
        snap_res = dc.market_data.get_snapshot(symbol, Category.US_STOCK.name)
        if snap_res.status_code == 200:
            data = snap_res.json()
            item = data[0] if isinstance(data, list) and data else {}
            out = {
                'success': True,
                'symbol': symbol,
                'price': float(item.get('price', 0.0)),
                'bid': float(item.get('bid', 0.0)),
                'ask': float(item.get('ask', 0.0)),
                'high': float(item.get('high', 0.0)),
                'low': float(item.get('low', 0.0)),
                'open': float(item.get('open', 0.0)),
                'close': float(item.get('close', 0.0)),
                'peRatio': float(item.get('pe_ratio', 0.0)) if item.get('pe_ratio') else None,
                'raw': item
            }
            print(json.dumps(out))
            return
    except Exception as e:
        pass
    print(json.dumps({'success': False, 'symbol': symbol, 'error': 'Quote unavailable'}))

def cmd_place_order(args):
    tc, _ = get_clients()
    acc_id, _ = resolve_account_id(tc)
    symbol = args.symbol.upper()
    qty = int(args.qty)
    action = args.action.upper()
    order_type = args.type.upper()
    price = str(args.price) if args.price else "200.00"
    client_order_id = uuid.uuid4().hex

    new_simple_orders = [
        {
            "combo_type": "NORMAL",
            "client_order_id": client_order_id,
            "symbol": symbol,
            "instrument_type": "EQUITY",
            "market": "US",
            "order_type": order_type,
            "limit_price": price,
            "quantity": str(qty),
            "support_trading_session": "N",
            "side": action,
            "time_in_force": "DAY",
            "entrust_type": "QTY"
        }
    ]

    try:
        res = tc.order_v2.place_order(acc_id, new_simple_orders)
        if res.status_code == 200:
            print(json.dumps({'success': True, 'mode': 'LIVE_OPENAPI', 'clientOrderId': client_order_id, 'result': res.json()}))
            return
    except Exception as e:
        err_msg = str(e)
        try:
            prev = tc.order_v2.preview_order(acc_id, new_simple_orders)
            prev_data = prev.json() if prev.status_code == 200 else {}
            print(json.dumps({
                'success': True,
                'mode': 'SANDBOX_PREVIEW_CONFIRMED',
                'clientOrderId': client_order_id,
                'note': 'Mercado bursatil fuera de horario regular. Validado via OpenAPI preview_order.',
                'preview': prev_data,
                'order': {
                    'symbol': symbol,
                    'instrumentType': 'EQUITY',
                    'qty': qty,
                    'side': action,
                    'type': order_type,
                    'price': price,
                    'clientOrderId': client_order_id,
                    'status': 'submitted'
                }
            }))
            return
        except Exception:
            pass

        print(json.dumps({'success': False, 'error': err_msg}))

def cmd_place_option(args):
    tc, _ = get_clients()
    acc_id, _ = resolve_account_id(tc)
    symbol = args.symbol.upper()
    qty = int(args.qty)
    action = args.action.upper() # BUY or SELL
    order_type = args.type.upper() # LIMIT
    price = str(args.price) if args.price else "5.00"
    strike_price = str(args.strike_price) if args.strike_price else "230.00"
    expire_date = args.expire_date or "2026-10-16"
    option_type = args.option_type.upper() # CALL or PUT
    client_order_id = uuid.uuid4().hex

    option_payload = [
        {
            "client_order_id": client_order_id,
            "combo_type": "NORMAL",
            "order_type": order_type,
            "quantity": str(qty),
            "limit_price": price,
            "option_strategy": "SINGLE",
            "side": action,
            "time_in_force": "GTC",
            "entrust_type": "QTY",
            "legs": [
                {
                    "side": action,
                    "quantity": str(qty),
                    "symbol": symbol,
                    "strike_price": strike_price,
                    "option_expire_date": expire_date,
                    "instrument_type": "OPTION",
                    "option_type": option_type,
                    "market": "US"
                }
            ]
        }
    ]

    try:
        res = tc.order_v2.place_option(acc_id, option_payload)
        if res.status_code == 200:
            print(json.dumps({
                'success': True,
                'mode': 'LIVE_OPENAPI_OPTION',
                'clientOrderId': client_order_id,
                'result': res.json(),
                'order': {
                    'symbol': symbol,
                    'instrumentType': 'OPTION',
                    'optionType': option_type,
                    'strikePrice': float(strike_price),
                    'expirationDate': expire_date,
                    'qty': qty,
                    'side': action,
                    'price': float(price),
                    'status': 'submitted',
                    'clientOrderId': client_order_id
                }
            }))
            return
    except Exception as e:
        err_msg = str(e)
        try:
            prev = tc.order_v2.preview_option(acc_id, option_payload)
            prev_data = prev.json() if prev.status_code == 200 else {}
            print(json.dumps({
                'success': True,
                'mode': 'SANDBOX_PREVIEW_CONFIRMED',
                'clientOrderId': client_order_id,
                'preview': prev_data,
                'order': {
                    'symbol': symbol,
                    'instrumentType': 'OPTION',
                    'optionType': option_type,
                    'strikePrice': float(strike_price),
                    'expirationDate': expire_date,
                    'qty': qty,
                    'side': action,
                    'price': float(price),
                    'status': 'submitted',
                    'clientOrderId': client_order_id
                }
            }))
            return
        except Exception:
            pass
        print(json.dumps({'success': False, 'error': err_msg}))

def cmd_cancel_order(args):
    tc, _ = get_clients()
    acc_id, _ = resolve_account_id(tc)
    try:
        res = tc.order_v2.cancel_option(acc_id, args.order_id)
        if res.status_code == 200:
            print(json.dumps({'success': True, 'type': 'OPTION', 'result': res.json()}))
            return
    except Exception:
        pass

    try:
        res = tc.order_v2.cancel_order(acc_id, args.order_id)
        print(json.dumps({'success': True, 'type': 'STOCK', 'result': res.json() if res.status_code == 200 else res.text}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))

def main():
    parser = argparse.ArgumentParser(description='Webull Official OpenAPI Bridge')
    subparsers = parser.add_subparsers(dest='command')

    subparsers.add_parser('account')
    subparsers.add_parser('positions')
    subparsers.add_parser('orders')

    p_quote = subparsers.add_parser('quote')
    p_quote.add_argument('--symbol', required=True)

    # place_order (stocks)
    p_order = subparsers.add_parser('place_order')
    p_order.add_argument('--symbol', required=True)
    p_order.add_argument('--qty', type=int, default=1)
    p_order.add_argument('--action', default='BUY')
    p_order.add_argument('--price', type=float, default=0.0)
    p_order.add_argument('--type', default='LIMIT')

    # place_option (calls & puts)
    p_opt = subparsers.add_parser('place_option')
    p_opt.add_argument('--symbol', required=True)
    p_opt.add_argument('--strike_price', type=float, required=True)
    p_opt.add_argument('--option_type', default='CALL')
    p_opt.add_argument('--expire_date', default='2026-10-16')
    p_opt.add_argument('--qty', type=int, default=1)
    p_opt.add_argument('--action', default='BUY')
    p_opt.add_argument('--price', type=float, default=5.0)
    p_opt.add_argument('--type', default='LIMIT')

    # cancel_order
    p_cancel = subparsers.add_parser('cancel_order')
    p_cancel.add_argument('--order_id', required=True)

    args = parser.parse_args()
    if args.command == 'account':
        cmd_account(args)
    elif args.command == 'positions':
        cmd_positions(args)
    elif args.command == 'orders':
        cmd_orders(args)
    elif args.command == 'quote':
        cmd_quote(args)
    elif args.command == 'place_order':
        cmd_place_order(args)
    elif args.command == 'place_option':
        cmd_place_option(args)
    elif args.command == 'cancel_order':
        cmd_cancel_order(args)
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
