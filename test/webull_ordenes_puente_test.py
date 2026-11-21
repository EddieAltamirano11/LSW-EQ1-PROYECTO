import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch


# Pruebas del puente de Webull sin red: el SDK se sustituye por dobles de prueba.
def cargarPuente():
    ruta = Path(__file__).resolve().parents[1] / 'scripts' / 'webull_desktop_bridge.py'
    especificacion = importlib.util.spec_from_file_location('webull_ordenes', ruta)
    puente = importlib.util.module_from_spec(especificacion)
    especificacion.loader.exec_module(puente)
    return puente


with patch.dict(sys.modules, {
    'webull.core.client': SimpleNamespace(ApiClient=object),
    'webull.trade.trade_client': SimpleNamespace(TradeClient=object),
    'webull.data.data_client': SimpleNamespace(DataClient=object),
    'webull.data.common.category': SimpleNamespace(Category=object),
}):
    puente = cargarPuente()


def respuesta(estado, datos=None, texto=''):
    return SimpleNamespace(status_code=estado, json=lambda: datos, text=texto)


def salida(comando, argumentos):
    capturada = io.StringIO()
    with contextlib.redirect_stdout(capturada):
        comando(argumentos)
    return json.loads(capturada.getvalue().strip().splitlines()[-1])


def clienteConCuenta():
    cuenta = Mock()
    cuenta.get_account_list.return_value = respuesta(200, [{'account_number': 'CTA', 'account_id': 'id-cta'}])
    ordenes = Mock()
    return SimpleNamespace(account_v2=cuenta, order_v2=ordenes, trade_instrument=Mock()), cuenta, ordenes


class PruebasOrdenesPuenteWebull(unittest.TestCase):
    def setUp(self):
        self.cliente, self.cuenta, self.ordenes = clienteConCuenta()
        self.parches = [
            patch.object(puente, 'TARGET_ACCOUNT_NUM', 'CTA'),
            patch.object(puente, 'get_clients', return_value=(self.cliente, None)),
        ]
        for parche in self.parches:
            parche.start()

    def tearDown(self):
        for parche in self.parches:
            parche.stop()

    def testCancelacionSoloConDoscientos(self):
        self.ordenes.cancel_option.return_value = respuesta(400, texto='not an option order')
        self.ordenes.cancel_order.return_value = respuesta(417, texto='Order already filled')
        resultado = salida(puente.cmd_cancel_order, SimpleNamespace(order_id='o-1'))
        self.assertFalse(resultado['success'])
        self.assertEqual(resultado['status'], 417)
        self.assertIn('Order already filled', resultado['error'])
        self.assertIn('not an option order', resultado['error'])

        self.ordenes.cancel_order.return_value = respuesta(200, {'order_id': 'o-1'})
        self.assertTrue(salida(puente.cmd_cancel_order, SimpleNamespace(order_id='o-1'))['success'])

        self.ordenes.cancel_option.side_effect = ConnectionError('sin red')
        self.ordenes.cancel_order.side_effect = ConnectionError('sin red')
        caida = salida(puente.cmd_cancel_order, SimpleNamespace(order_id='o-1'))
        self.assertFalse(caida['success'])
        self.assertEqual(caida['status'], 503)

    def testCuentaSinSaldosNoInventaValores(self):
        self.cuenta.get_account_balance.return_value = respuesta(200, {
            'total_asset_currency': 'USD', 'total_cash_balance': '10', 'total_net_liquidation_value': '12',
            'account_currency_assets': [{}],
        })
        incompleta = salida(puente.cmd_account, SimpleNamespace(strict=False))
        self.assertFalse(incompleta['success'])
        self.assertEqual(incompleta['status'], 502)
        self.assertNotIn('1000000', json.dumps(incompleta))

        self.cuenta.get_account_balance.return_value = respuesta(200, {
            'total_asset_currency': 'USD', 'total_cash_balance': '10', 'total_net_liquidation_value': '12',
            'account_currency_assets': [{'buying_power': '8'}],
        })
        completa = salida(puente.cmd_account, SimpleNamespace(strict=False))
        self.assertEqual([completa['cash'], completa['portfolioValue'], completa['buyingPower']], [10.0, 12.0, 8.0])

    def testCuentaNoConfiguradaNoUsaIdentificadorPorDefecto(self):
        self.cuenta.get_account_list.return_value = respuesta(500, texto='error')
        resultado = salida(puente.cmd_orders, SimpleNamespace())
        self.assertFalse(resultado['success'])
        self.assertEqual(resultado['status'], 503)
        self.ordenes.get_order_open.assert_not_called()

    def testOrdenesFallidasNoSonListaVacia(self):
        self.ordenes.get_order_open.return_value = respuesta(200, [])
        self.ordenes.get_order_history.return_value = respuesta(500, texto='history caído')
        resultado = salida(puente.cmd_orders, SimpleNamespace())
        self.assertFalse(resultado['success'])
        self.assertEqual(resultado['status'], 503)

        self.ordenes.get_order_history.return_value = respuesta(200, [])
        self.assertEqual(salida(puente.cmd_orders, SimpleNamespace()), {'success': True, 'orders': []})

    def testArgumentosObligatoriosYSinPreview(self):
        parser = puente.construir_parser()
        with contextlib.redirect_stderr(io.StringIO()):
            for incompletos in (
                ['place_order', '--symbol', 'AAPL'],
                ['place_order', '--symbol', 'AAPL', '--qty', '1', '--action', 'BUY'],
                ['place_option', '--symbol', 'AAPL', '--strike_price', '300', '--qty', '1', '--action', 'BUY', '--type', 'LIMIT', '--price', '2'],
                ['place_order', '--symbol', 'AAPL', '--qty', '1', '--action', 'BUY', '--type', 'LIMIT', '--price', '2', '--preview'],
            ):
                with self.assertRaises(SystemExit):
                    parser.parse_args(incompletos)

    def testMercadoSinPrecioLimiteYLimiteSinPrecioRechazado(self):
        self.ordenes.place_order.return_value = respuesta(200, {'order_id': 'o-9'})
        parser = puente.construir_parser()
        mercado = parser.parse_args(['place_order', '--symbol', 'AAPL', '--qty', '2', '--action', 'BUY', '--type', 'MARKET'])
        resultado = salida(puente.cmd_place_order, mercado)
        self.assertTrue(resultado['success'])
        enviada = self.ordenes.place_order.call_args.args[1][0]
        self.assertNotIn('limit_price', enviada)
        self.assertEqual(enviada['order_type'], 'MARKET')

        self.ordenes.place_order.reset_mock()
        limite = parser.parse_args(['place_order', '--symbol', 'AAPL', '--qty', '2', '--action', 'BUY', '--type', 'LIMIT'])
        rechazada = salida(puente.cmd_place_order, limite)
        self.assertFalse(rechazada['success'])
        self.assertEqual(rechazada['status'], 400)
        self.ordenes.place_order.assert_not_called()

    def testCoveredStockSinPrecioDeAccionesNoUsaRespaldo(self):
        parser = puente.construir_parser()
        argumentos = parser.parse_args([
            'place_option', '--symbol', 'AAPL', '--strike_price', '370', '--option_type', 'CALL', '--expire_date', '2026-12-18',
            '--qty', '1', '--action', 'SELL', '--type', 'LIMIT', '--price', '1.8', '--strategy', 'COVERED_STOCK',
        ])
        resultado = salida(puente.cmd_place_option, argumentos)
        self.assertFalse(resultado['success'])
        self.assertEqual(resultado['status'], 400)
        self.cliente.trade_instrument.get_instrument_quote.assert_not_called()
        self.ordenes.place_option.assert_not_called()

    def testRechazoDeNegocioDeWebullNoSeInformaComoCaida(self):
        # El SDK lanza ServerException con http_status 417 cuando Webull rechaza la orden (por ejemplo, fuera de horario).
        class ServerException(Exception):
            http_status = 417

            def __str__(self):
                return 'HTTP Status: 417, Code: OPENAPI_CAN_NOT_TRADING_FOR_NON_TRADING_HOURS, Msg: fuera de horario'
        self.ordenes.place_order.side_effect = ServerException()
        argumentos = puente.construir_parser().parse_args(
            ['place_order', '--symbol', 'AAPL', '--qty', '1', '--action', 'BUY', '--type', 'LIMIT', '--price', '200'])
        rechazada = salida(puente.cmd_place_order, argumentos)
        self.assertFalse(rechazada['success'])
        self.assertEqual(rechazada['status'], 417)
        self.assertIn('NON_TRADING_HOURS', rechazada['error'])

        self.ordenes.place_order.side_effect = ConnectionError('sin red')
        self.assertEqual(salida(puente.cmd_place_order, argumentos)['status'], 503)


if __name__ == '__main__':
    unittest.main()
