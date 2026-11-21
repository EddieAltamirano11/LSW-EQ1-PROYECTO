import sys
import os
import json
import uuid
import argparse
import logging

# Silenciar logs internos del SDK de Webull para que la salida estandar sea exclusivamente JSON
logging.basicConfig(level=logging.CRITICAL)
logging.disable(logging.CRITICAL)

# Cargar variables de entorno manualmente desde .env 
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
from webull.core.http.initializer.client_initializer import ClientInitializer

# Prevenir error 429 TOO_MANY_REQUESTS en chequeo redundante de token
ClientInitializer._check_token_enable = lambda self: False

APP_KEY = os.getenv('WEBULL_APP_KEY')
APP_SECRET = os.getenv('WEBULL_APP_SECRET')
REGION_ID = os.getenv('WEBULL_REGION_ID') or 'us'
DEFAULT_ENDPOINT = os.getenv('WEBULL_ENDPOINT') or 'api.sandbox.webull.com'
TARGET_ACCOUNT_NUM = os.getenv('WEBULL_ACCOUNT_ID') or 'DEV4Q8EB'

def get_clients():
    client = ApiClient(APP_KEY, APP_SECRET, REGION_ID)
    client.add_endpoint(REGION_ID, DEFAULT_ENDPOINT)
    tc = TradeClient(client)
    dc = DataClient(client)
    return tc, dc

class CuentaNoDisponible(Exception):
    pass


def resolve_account_id(tc):
    """Resuelve el account_id interno de Webull a partir del número configurado; sin cuenta confirmada no hay identificador."""
    respuesta = tc.account_v2.get_account_list()
    if respuesta.status_code != 200:
        raise CuentaNoDisponible(f'Webull no entregó el listado de cuentas (HTTP {respuesta.status_code}).')
    cuentas = respuesta.json()
    if isinstance(cuentas, list):
        for cuenta in cuentas:
            if isinstance(cuenta, dict) and TARGET_ACCOUNT_NUM in (cuenta.get('account_number'), cuenta.get('account_id')):
                return cuenta.get('account_id'), cuenta
    raise CuentaNoDisponible('La cuenta configurada no aparece en el listado de Webull.')


def imprimir(datos):
    print(json.dumps(datos, allow_nan=False))


def numero_reportado(valor):
    """Convierte un valor reportado por Webull; None si falta o no es numérico (nunca un valor por defecto)."""
    if valor is None or valor == '':
        return None
    try:
        return float(valor)
    except (TypeError, ValueError):
        return None


def con_cuenta(comando):
    """Ejecuta el comando con la cuenta confirmada; si Webull no responde, informa 503 sin datos supuestos."""
    def envoltura(args):
        try:
            tc, _ = get_clients()
            acc_id, acc_meta = resolve_account_id(tc)
        except Exception as error:
            imprimir({'success': False, 'status': 503, 'error': str(error)})
            return
        try:
            comando(args, tc, acc_id, acc_meta)
        except Exception as error:
            imprimir({'success': False, 'status': estado_de_excepcion(error), 'error': str(error)})
    return envoltura


def estado_de_excepcion(error):
    """Un 4xx del SDK (por ejemplo 417 con un código de negocio) es un rechazo de Webull, no una falta de respuesta."""
    estado = getattr(error, 'http_status', None)
    try:
        estado = int(estado)
    except (TypeError, ValueError):
        return 503
    return estado if 400 <= estado < 500 else 503


def leerRespuestaConfirmada(respuesta):
    if respuesta.status_code != 200:
        raise RuntimeError('Webull no pudo completar la consulta')
    return respuesta.json()


def consultarPortafolioConfirmado(esConsultaCuenta):
    try:
        clienteOperaciones, _ = get_clients()
        apiCuenta = clienteOperaciones.account_v2
        cuentas = leerRespuestaConfirmada(apiCuenta.get_account_list())
        if not isinstance(cuentas, list) or any(not isinstance(cuenta, dict) for cuenta in cuentas):
            raise ValueError('Listado de cuentas inválido')

        cuentaConfigurada = TARGET_ACCOUNT_NUM or 'DEV4Q8EB'
        idCuenta = next((
            cuenta.get('account_id')
            for cuenta in cuentas
            if cuentaConfigurada in (cuenta.get('account_number'), cuenta.get('account_id'))
        ), None)
        if not idCuenta:
            raise RuntimeError('La cuenta configurada no está disponible')

        if esConsultaCuenta:
            datosConfirmados = leerRespuestaConfirmada(apiCuenta.get_account_balance(idCuenta))
        else:
            datosConfirmados = leerRespuestaConfirmada(apiCuenta.get_account_position(idCuenta))

        origen = 'Webull OpenAPI (paper trading)' if DEFAULT_ENDPOINT == 'api.sandbox.webull.com' else 'Webull OpenAPI'
        print(json.dumps({'success': True, 'data': datosConfirmados, 'source': origen}, allow_nan=False))
    except (ValueError, TypeError, KeyError):
        print(json.dumps({'success': False, 'status': 502}))
    except Exception:
        print(json.dumps({'success': False, 'status': 503}))


def cmd_account(args):
    if getattr(args, 'strict', False):
        return consultarPortafolioConfirmado(True)
    return _cmd_account(args)


@con_cuenta
def _cmd_account(args, tc, acc_id, acc_meta):
    bal_res = tc.account_v2.get_account_balance(acc_id)
    if bal_res.status_code != 200:
        imprimir({'success': False, 'status': 503, 'error': bal_res.text})
        return
    data = bal_res.json()
    activos = data.get('account_currency_assets') or [{}]
    saldos = {
        'portfolioValue': numero_reportado(data.get('total_net_liquidation_value')),
        'cash': numero_reportado(data.get('total_cash_balance')),
        'buyingPower': numero_reportado((activos[0] or {}).get('buying_power')),
    }
    faltan = [campo for campo, valor in saldos.items() if valor is None]
    if faltan:
        imprimir({'success': False, 'status': 502, 'error': f"Webull no informó {', '.join(faltan)} en el balance."})
        return
    imprimir({
        'success': True,
        'broker': 'WEBULL',
        'accountNumber': acc_meta.get('account_number'),
        'accountId': acc_id,
        'accountType': acc_meta.get('account_type'),
        'currency': data.get('total_asset_currency'),
        **saldos,
        'unrealizedPL': numero_reportado(data.get('total_unrealized_profit_loss')),
        'dayPL': numero_reportado(data.get('total_day_profit_loss')),
    })


def cmd_positions(args):
    if getattr(args, 'strict', False):
        return consultarPortafolioConfirmado(False)
    return _cmd_positions(args)


@con_cuenta
def _cmd_positions(args, tc, acc_id, _meta):
    pos_res = tc.account_v2.get_account_position(acc_id)
    if pos_res.status_code == 200:
        imprimir({'success': True, 'positions': pos_res.json()})
    else:
        imprimir({'success': False, 'status': 503, 'error': pos_res.text})


def aplanar_ordenes(crudas):
    aplanadas = []
    for item in crudas:
        if isinstance(item.get('orders'), list):
            for sub in item['orders']:
                sub['parent_client_order_id'] = item.get('client_order_id')
                sub['combo_order_id'] = item.get('combo_order_id')
                aplanadas.append(sub)
        else:
            aplanadas.append(item)
    return aplanadas


@con_cuenta
def cmd_orders(args, tc, acc_id, _meta):
    abiertas = tc.order_v2.get_order_open(acc_id)
    historial = tc.order_v2.get_order_history(acc_id)
    for nombre, consulta in (('abiertas', abiertas), ('historial', historial)):
        if consulta.status_code != 200:
            imprimir({'success': False, 'status': 503, 'error': f'Webull no entregó las órdenes {nombre} (HTTP {consulta.status_code}): {consulta.text}'})
            return
    crudas_abiertas, crudas_historial = abiertas.json(), historial.json()
    if not isinstance(crudas_abiertas, list) or not isinstance(crudas_historial, list):
        imprimir({'success': False, 'status': 502, 'error': 'Webull devolvió órdenes con un formato inesperado.'})
        return
    imprimir({'success': True, 'orders': aplanar_ordenes(crudas_abiertas) + aplanar_ordenes(crudas_historial)})


def cmd_quote(args):
    symbol = args.symbol.upper()
    try:
        _, dc = get_clients()
        snap_res = dc.market_data.get_snapshot(symbol, Category.US_STOCK.name)
    except Exception as error:
        imprimir({'success': False, 'status': 503, 'symbol': symbol, 'error': str(error)})
        return
    if snap_res.status_code != 200:
        imprimir({'success': False, 'status': 503, 'symbol': symbol, 'error': snap_res.text})
        return
    data = snap_res.json()
    item = data[0] if isinstance(data, list) and data else {}
    precio = numero_reportado(item.get('price'))
    if not precio:
        imprimir({'success': False, 'status': 502, 'symbol': symbol, 'error': 'Webull no informó un precio.'})
        return
    imprimir({
        'success': True,
        'symbol': symbol,
        'price': precio,
        'bid': numero_reportado(item.get('bid')),
        'ask': numero_reportado(item.get('ask')),
        'high': numero_reportado(item.get('high')),
        'low': numero_reportado(item.get('low')),
        'open': numero_reportado(item.get('open')),
        'close': numero_reportado(item.get('close')),
        'peRatio': numero_reportado(item.get('pe_ratio')),
    })


def precio_de_orden(args):
    """LIMIT exige precio positivo; MARKET se envía sin limit_price. Devuelve (precio, error)."""
    tipo = args.type.upper()
    if tipo == 'LIMIT':
        if not args.price or args.price <= 0:
            return None, 'Una orden LIMIT requiere --price positivo.'
        return str(args.price), None
    if tipo == 'MARKET':
        return None, None
    return None, f'Tipo de orden no admitido: {tipo}.'


def enviar(tc, metodo, acc_id, carga, client_order_id, extra=None):
    res = getattr(tc.order_v2, metodo)(acc_id, carga)
    if res.status_code == 200:
        imprimir({'success': True, 'clientOrderId': client_order_id, 'result': res.json(), **(extra or {})})
    else:
        imprimir({'success': False, 'status': res.status_code, 'clientOrderId': client_order_id, 'error': res.text})


@con_cuenta
def cmd_place_order(args, tc, acc_id, _meta):
    precio, error = precio_de_orden(args)
    if error:
        imprimir({'success': False, 'status': 400, 'error': error})
        return
    client_order_id = uuid.uuid4().hex
    orden = {
        "combo_type": "NORMAL",
        "client_order_id": client_order_id,
        "symbol": args.symbol.upper(),
        "instrument_type": "EQUITY",
        "market": "US",
        "order_type": args.type.upper(),
        "quantity": str(args.qty),
        "support_trading_session": "CORE",
        "side": args.action.upper(),
        "time_in_force": args.time_in_force.upper(),
        "entrust_type": "QTY",
    }
    if precio is not None:
        orden["limit_price"] = precio
    enviar(tc, 'place_order', acc_id, [orden], client_order_id)


@con_cuenta
def cmd_place_option(args, tc, acc_id, _meta):
    precio, error = precio_de_orden(args)
    estrategia = args.strategy.upper()
    if not error and estrategia == 'COVERED_STOCK' and not (args.stock_price and args.stock_price > 0):
        error = 'COVERED_STOCK requiere --stock_price positivo; no se usa una cotización de respaldo.'
    if error:
        imprimir({'success': False, 'status': 400, 'error': error})
        return
    symbol = args.symbol.upper()
    client_order_id = uuid.uuid4().hex
    pata_opcion = {
        "side": args.action.upper() if estrategia == 'SINGLE' else "SELL",
        "quantity": str(args.qty),
        "symbol": symbol,
        "strike_price": str(args.strike_price),
        "option_expire_date": args.expire_date,
        "instrument_type": "OPTION",
        "option_type": args.option_type.upper() if estrategia == 'SINGLE' else "CALL",
        "market": "US",
    }
    orden = {
        "client_order_id": client_order_id,
        "combo_type": "NORMAL",
        "order_type": args.type.upper(),
        "quantity": str(args.qty),
        "option_strategy": estrategia,
        "side": args.action.upper() if estrategia == 'SINGLE' else "BUY",
        "time_in_force": args.time_in_force.upper(),
        "entrust_type": "QTY",
        "legs": [pata_opcion] if estrategia == 'SINGLE' else [
            {"side": "BUY", "quantity": str(args.qty * 100), "symbol": symbol, "instrument_type": "EQUITY", "market": "US"},
            pata_opcion,
        ],
    }
    if precio is not None:
        # En COVERED_STOCK el limit_price es el neto por acción del combo (acciones − prima del Call):
        # preview_option devolvió estimated_cost = limit_price × 100 (verificado el 2026-11-20).
        orden["limit_price"] = precio
    enviar(tc, 'place_option', acc_id, [orden], client_order_id, {'strategy': estrategia})


@con_cuenta
def cmd_cancel_order(args, tc, acc_id, _meta):
    """Éxito solo si alguna de las dos rutas (opción o acción) responde 200; si ambas fallan, se informan las dos causas."""
    errores = []
    estado = None
    for metodo, tipo in (('cancel_option', 'OPTION'), ('cancel_order', 'STOCK')):
        try:
            res = getattr(tc.order_v2, metodo)(acc_id, args.order_id)
        except Exception as error:
            errores.append(f'{tipo}: {error}')
            continue
        if res.status_code == 200:
            imprimir({'success': True, 'type': tipo, 'result': res.json()})
            return
        estado = res.status_code
        errores.append(f'{tipo} (HTTP {res.status_code}): {res.text}')
    imprimir({'success': False, 'status': estado or 503, 'error': ' | '.join(errores)})


def construir_parser():
    parser = argparse.ArgumentParser(description='Webull Official OpenAPI Bridge')
    subparsers = parser.add_subparsers(dest='command')

    subparsers.add_parser('account').add_argument('--strict', action='store_true')
    subparsers.add_parser('positions').add_argument('--strict', action='store_true')
    subparsers.add_parser('orders')

    p_quote = subparsers.add_parser('quote')
    p_quote.add_argument('--symbol', required=True)

    # Sin valores por defecto de cantidad, lado, tipo, precio, contrato ni vencimiento.
    p_order = subparsers.add_parser('place_order')
    p_order.add_argument('--symbol', required=True)
    p_order.add_argument('--qty', type=int, required=True)
    p_order.add_argument('--action', required=True, choices=['BUY', 'SELL'], type=str.upper)
    p_order.add_argument('--type', required=True, choices=['LIMIT', 'MARKET'], type=str.upper)
    p_order.add_argument('--price', type=float)
    p_order.add_argument('--time_in_force', default='DAY', choices=['DAY', 'GTC'], type=str.upper)

    p_opt = subparsers.add_parser('place_option')
    p_opt.add_argument('--symbol', required=True)
    p_opt.add_argument('--strike_price', type=float, required=True)
    p_opt.add_argument('--option_type', required=True, choices=['CALL', 'PUT'], type=str.upper)
    p_opt.add_argument('--expire_date', required=True)
    p_opt.add_argument('--qty', type=int, required=True)
    p_opt.add_argument('--action', required=True, choices=['BUY', 'SELL'], type=str.upper)
    p_opt.add_argument('--type', required=True, choices=['LIMIT', 'MARKET'], type=str.upper)
    p_opt.add_argument('--price', type=float)
    p_opt.add_argument('--stock_price', type=float)
    p_opt.add_argument('--strategy', default='SINGLE', choices=['SINGLE', 'COVERED_STOCK'], type=str.upper)
    p_opt.add_argument('--time_in_force', default='DAY', choices=['DAY', 'GTC'], type=str.upper)

    p_cancel = subparsers.add_parser('cancel_order')
    p_cancel.add_argument('--order_id', required=True)
    return parser


def main():
    parser = construir_parser()
    args = parser.parse_args()
    comandos = {
        'account': cmd_account, 'positions': cmd_positions, 'orders': cmd_orders, 'quote': cmd_quote,
        'place_order': cmd_place_order, 'place_option': cmd_place_option, 'cancel_order': cmd_cancel_order,
    }
    if args.command in comandos:
        comandos[args.command](args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
