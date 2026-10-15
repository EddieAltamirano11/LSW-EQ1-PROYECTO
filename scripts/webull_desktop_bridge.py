import sys
import os
import json
import argparse
from webull import paper_webull

SESSION_FILE = os.path.join(os.path.dirname(__file__), 'webull_session.json')

def get_client():
    wb = paper_webull()
    if os.path.exists(SESSION_FILE):
        try:
            with open(SESSION_FILE, 'r') as f:
                data = json.load(f)
            wb._access_token = data.get('accessToken')
            wb._refresh_token = data.get('refreshToken')
            wb._token_expire = data.get('tokenExpireTime')
            wb._uuid = data.get('uuid')
            wb._account_id = data.get('accountId') or wb.get_account_id()
        except Exception as e:
            pass
    return wb

def save_session(wb, account_id=None):
    data = {
        'accessToken': wb._access_token,
        'refreshToken': wb._refresh_token,
        'tokenExpireTime': wb._token_expire,
        'uuid': wb._uuid,
        'accountId': account_id or getattr(wb, '_account_id', None)
    }
    with open(SESSION_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def cmd_get_mfa(args):
    wb = paper_webull()
    res = wb.get_mfa(args.account)
    print(json.dumps({'success': True, 'result': res}))

def cmd_login(args):
    wb = paper_webull()
    account = args.account
    password = args.password
    mfa = args.mfa or ''

    res = wb.login(account, password, mfa=mfa)
    if 'accessToken' in res:
        acc_id = wb.get_account_id()
        save_session(wb, acc_id)
        print(json.dumps({'success': True, 'message': 'Login exitoso', 'accountId': acc_id, 'data': res}))
    else:
        print(json.dumps({'success': False, 'message': 'Fallo el login o se requiere MFA/SMS', 'data': res}))

def cmd_account(args):
    wb = get_client()
    if not wb.is_logged_in():
        print(json.dumps({'success': False, 'error': 'No hay sesion activa en Webull Desktop Bridge'}))
        return
    acc = wb.get_account()
    print(json.dumps({'success': True, 'account': acc}))

def cmd_positions(args):
    wb = get_client()
    if not wb.is_logged_in():
        print(json.dumps({'success': False, 'error': 'No hay sesion activa'}))
        return
    pos = wb.get_positions()
    print(json.dumps({'success': True, 'positions': pos}))

def cmd_orders(args):
    wb = get_client()
    if not wb.is_logged_in():
        print(json.dumps({'success': False, 'error': 'No hay sesion activa'}))
        return
    orders = wb.get_current_orders()
    print(json.dumps({'success': True, 'orders': orders}))

def cmd_place_order(args):
    wb = get_client()
    if not wb.is_logged_in():
        print(json.dumps({'success': False, 'error': 'No hay sesion activa'}))
        return
    symbol = args.symbol.upper()
    qty = int(args.qty)
    action = args.action.upper() # BUY or SELL
    price = float(args.price or 0.0)
    order_type = args.type.upper() # MKT or LMT

    res = wb.place_order(
        stock=symbol,
        price=price,
        action=action,
        orderType=order_type,
        quant=qty,
        enforce='DAY',
        outsideRegularTradingHour=True
    )
    print(json.dumps({'success': True, 'order': res}))

def cmd_cancel_order(args):
    wb = get_client()
    if not wb.is_logged_in():
        print(json.dumps({'success': False, 'error': 'No hay sesion activa'}))
        return
    res = wb.cancel_order(args.order_id)
    print(json.dumps({'success': True, 'result': res}))

def main():
    parser = argparse.ArgumentParser(description='Webull Desktop Bridge')
    subparsers = parser.add_subparsers(dest='command')

    # get_mfa
    p_mfa = subparsers.add_parser('get_mfa')
    p_mfa.add_argument('--account', required=True, help='Email o telefono')

    # login
    p_login = subparsers.add_parser('login')
    p_login.add_argument('--account', required=True, help='Email o telefono')
    p_login.add_argument('--password', required=True, help='Password')
    p_login.add_argument('--mfa', default='', help='Codigo MFA o SMS')

    # account
    subparsers.add_parser('account')

    # positions
    subparsers.add_parser('positions')

    # orders
    subparsers.add_parser('orders')

    # place_order
    p_order = subparsers.add_parser('place_order')
    p_order.add_argument('--symbol', required=True)
    p_order.add_argument('--qty', type=int, default=1)
    p_order.add_argument('--action', default='BUY')
    p_order.add_argument('--price', type=float, default=0.0)
    p_order.add_argument('--type', default='MKT')

    # cancel_order
    p_cancel = subparsers.add_parser('cancel_order')
    p_cancel.add_argument('--order_id', required=True)

    args = parser.parse_args()
    if args.command == 'get_mfa':
        cmd_get_mfa(args)
    elif args.command == 'login':
        cmd_login(args)
    elif args.command == 'account':
        cmd_account(args)
    elif args.command == 'positions':
        cmd_positions(args)
    elif args.command == 'orders':
        cmd_orders(args)
    elif args.command == 'place_order':
        cmd_place_order(args)
    elif args.command == 'cancel_order':
        cmd_cancel_order(args)
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
