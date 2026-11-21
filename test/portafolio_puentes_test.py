import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch


def cargarPuente(nombre):
    ruta = Path(__file__).resolve().parents[1] / 'scripts' / f'{nombre}_desktop_bridge.py'
    especificacion = importlib.util.spec_from_file_location(nombre, ruta)
    puente = importlib.util.module_from_spec(especificacion)
    especificacion.loader.exec_module(puente)
    return puente


with patch.dict(sys.modules, {
    'webull.core.client': SimpleNamespace(ApiClient=object),
    'webull.trade.trade_client': SimpleNamespace(TradeClient=object),
    'webull.data.data_client': SimpleNamespace(DataClient=object),
    'webull.data.common.category': SimpleNamespace(Category=object),
}):
    puenteWebull = cargarPuente('webull')
puenteIbkr = cargarPuente('ibkr')


def capturarRespuesta(consultar):
    salida = io.StringIO()
    with contextlib.redirect_stdout(salida):
        consultar(SimpleNamespace(strict=True))
    return json.loads(salida.getvalue())


def respuestaWebull(datos):
    return SimpleNamespace(status_code=200, json=lambda: datos)


class PruebasPuentesPortafolio(unittest.TestCase):
    def testWebullSeleccionaCuentaConfigurada(self):
        apiCuenta = Mock()
        apiCuenta.get_account_list.return_value = respuestaWebull([
            {'account_number': 'otra', 'account_id': 'ignorar'},
            {'account_number': 'objetivo', 'account_id': 'cuenta-id'},
        ])
        apiCuenta.get_account_balance.return_value = respuestaWebull({'total_cash_balance': '0'})
        apiCuenta.get_account_position.return_value = respuestaWebull([])
        cliente = SimpleNamespace(account_v2=apiCuenta)

        with patch.object(puenteWebull, 'TARGET_ACCOUNT_NUM', 'objetivo'), patch.object(
            puenteWebull, 'get_clients', return_value=(cliente, None)
        ):
            cuenta = capturarRespuesta(puenteWebull.cmd_account)
            posiciones = capturarRespuesta(puenteWebull.cmd_positions)
            apiCuenta.get_account_balance.assert_called_once_with('cuenta-id')
            apiCuenta.get_account_position.assert_called_once_with('cuenta-id')
            self.assertEqual(cuenta['data'], {'total_cash_balance': '0'})
            self.assertEqual(posiciones['data'], [])

            apiCuenta.get_account_list.return_value = respuestaWebull([])
            self.assertEqual(capturarRespuesta(puenteWebull.cmd_positions)['status'], 503)
            apiCuenta.get_account_position.assert_called_once()
            apiCuenta.get_account_list.return_value = respuestaWebull({'error': 'formato'})
            self.assertEqual(capturarRespuesta(puenteWebull.cmd_account)['status'], 502)

    def testIbkrCompruebaCuentaYConservaCamposConfirmados(self):
        conexion = Mock()
        conexion.managedAccounts.return_value = ['objetivo']
        conexion.accountSummary.return_value = [
            SimpleNamespace(tag='TotalCashValue', currency='USD', value='0'),
            SimpleNamespace(tag='BuyingPower', currency='USD', value='100'),
        ]
        contrato = SimpleNamespace(conId=12, symbol='AAPL', localSymbol='AAPL 261218P00150000')
        conexion.reqPositions.return_value = [
            SimpleNamespace(account='objetivo', contract=contrato, position=-2.0),
            SimpleNamespace(account='otra', contract=contrato, position=99.0),
        ]
        with patch.object(puenteIbkr, 'ACCOUNT_ID', 'objetivo'), patch.object(
            puenteIbkr, 'get_ib_connection', return_value=conexion
        ):
            cuenta = capturarRespuesta(puenteIbkr.cmd_account)
            posiciones = capturarRespuesta(puenteIbkr.cmd_positions)
            self.assertEqual(cuenta['data'], {'currency': 'USD', 'cash': '0', 'buyingPower': '100'})
            self.assertEqual(posiciones['data'], [{'assetId': 12, 'symbol': contrato.localSymbol, 'qty': -2.0}])
            conexion.accountSummary.assert_called_once_with('objetivo')
            conexion.reqPositions.assert_called_once_with()
            self.assertEqual(conexion.disconnect.call_count, 2)

            conexion.managedAccounts.return_value = ['otra']
            self.assertEqual(capturarRespuesta(puenteIbkr.cmd_positions)['status'], 503)
            conexion.reqPositions.assert_called_once()
            conexion.managedAccounts.return_value = ['objetivo']
            conexion.reqPositions.side_effect = TimeoutError()
            self.assertEqual(capturarRespuesta(puenteIbkr.cmd_positions)['status'], 503)


class PruebasCotizacionIbkr(unittest.TestCase):
    def _conexion(self, bid, ask):
        conexion = Mock()
        conexion.isConnected.return_value = True
        conexion.reqHistoricalData.return_value = [SimpleNamespace(close=265.29, high=283.15, low=264.22, open=274.32)]
        conexion.reqMktData.return_value = SimpleNamespace(bid=bid, ask=ask, bidSize=3.0, askSize=4.0, time=None, marketDataType=3)
        return conexion

    def _cotizar(self, conexion):
        salida = io.StringIO()
        with patch.object(puenteIbkr, 'get_ib_connection', return_value=conexion), patch.object(puenteIbkr, 'Stock', create=True), \
                contextlib.redirect_stdout(salida):
            puenteIbkr.cmd_quote(SimpleNamespace(symbol='GOOGL'))
        return json.loads(salida.getvalue().strip().splitlines()[-1])

    def testInformaElBidYAskObservadosDeTws(self):
        cotizacion = self._cotizar(self._conexion(265.1, 265.4))
        self.assertEqual([cotizacion['bid'], cotizacion['ask'], cotizacion['marketDataType']], [265.1, 265.4, 3])
        self.assertEqual(cotizacion['price'], 265.29)

    def testSinPuntasDeTwsNoLasDerivaDelCierre(self):
        cotizacion = self._cotizar(self._conexion(float('nan'), float('nan')))
        self.assertIsNone(cotizacion['bid'])
        self.assertIsNone(cotizacion['ask'])
        self.assertEqual(cotizacion['price'], 265.29)


class PruebasCancelacionIbkr(unittest.TestCase):
    def _cancelar(self, estados):
        orden = SimpleNamespace(orderId=444, permId=630084668)
        estado = SimpleNamespace(status=estados[0])
        operacion = SimpleNamespace(order=orden, orderStatus=estado)
        conexion = Mock()
        conexion.isConnected.return_value = True
        conexion.trades.return_value = [operacion]
        secuencia = iter(estados[1:])
        conexion.sleep.side_effect = lambda _s: setattr(estado, 'status', next(secuencia, estado.status))
        salida = io.StringIO()
        with patch.object(puenteIbkr, 'get_ib_connection', return_value=conexion), contextlib.redirect_stdout(salida):
            puenteIbkr.cmd_cancel_order(SimpleNamespace(order_id='444'))
        return json.loads(salida.getvalue().strip().splitlines()[-1]), conexion

    def testEsperaLaConfirmacionDeTws(self):
        resultado, conexion = self._cancelar(['Submitted', 'PendingCancel', 'PendingCancel', 'Cancelled'])
        self.assertEqual([resultado['success'], resultado['status']], [True, 'Cancelled'])
        self.assertNotIn('pending', resultado)
        self.assertEqual(conexion.sleep.call_count, 3)

    def testPendingCancelSeInformaComoSolicitudEnCurso(self):
        resultado, _ = self._cancelar(['Submitted', 'PendingCancel'])
        self.assertEqual([resultado['success'], resultado['status'], resultado['pending']], [True, 'PendingCancel', True])

    def testOtroEstadoNoEsCancelacion(self):
        resultado, _ = self._cancelar(['Filled'])
        self.assertFalse(resultado['success'])
        self.assertEqual(resultado['status'], 502)


if __name__ == '__main__':
    unittest.main()
