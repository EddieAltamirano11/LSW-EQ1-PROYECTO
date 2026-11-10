import boom from '@hapi/boom';
import config from '../../../config/config.js';
import { isAlpacaConfigured } from '../../../config/broker.config.js';
import { getAlpacaAccount, getAlpacaPositions } from './alpaca.service.js';
import { runBridge as ejecutarPuenteWebull } from './webull.service.js';
import { runBridge as ejecutarPuenteIbkr } from './ibkr.service.js';

const mensajeNoDisponible = 'No se pudo consultar el broker seleccionado.';
const mensajeFormatoInvalido = 'El broker devolvió datos que no se pueden interpretar.';

function convertirImporte(valor) {
  if (typeof valor !== 'number' && (typeof valor !== 'string' || !valor.trim())) return null;
  const importe = Number(valor);
  return Number.isFinite(importe) ? importe : null;
}

function leerTexto(valor) {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}

async function consultarBrokerConfirmado(corredor, comando) {
  if (corredor === 'ALPACA') {
    if (!isAlpacaConfigured()) throw boom.serverUnavailable(mensajeNoDisponible);
    let datos;
    try {
      datos = await (comando === 'account' ? getAlpacaAccount() : getAlpacaPositions());
    } catch {
      throw boom.serverUnavailable(mensajeNoDisponible);
    }
    const esCuentaPaper = new URL(config.ALPACA_BASE_URL).hostname === 'paper-api.alpaca.markets';
    return { datos, origen: esCuentaPaper ? 'Alpaca (paper trading)' : 'Alpaca' };
  }

  const respuesta = corredor === 'WEBULL'
    ? ejecutarPuenteWebull(comando, ['--strict'])
    : ejecutarPuenteIbkr(comando, ['--strict']);
  if (respuesta?.status === 502) throw boom.badGateway(mensajeFormatoInvalido);
  if (respuesta?.success !== true || (corredor === 'IBKR' && respuesta.mode !== 'LIVE_TWS_SOCKET')) {
    throw boom.serverUnavailable(mensajeNoDisponible);
  }
  if (!Object.hasOwn(respuesta, 'data')) throw boom.badGateway(mensajeFormatoInvalido);
  return { datos: respuesta.data, origen: leerTexto(respuesta.source) };
}

export async function consultarCuentaConfirmada(corredor) {
  const { datos, origen } = await consultarBrokerConfirmado(corredor, 'account');
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw boom.badGateway(mensajeFormatoInvalido);
  }

  const moneda = leerTexto(corredor === 'WEBULL' ? datos.total_asset_currency : datos.currency);
  const activosPorMoneda = Array.isArray(datos.account_currency_assets) ? datos.account_currency_assets : [];
  const activos = activosPorMoneda.find((activo) => moneda && activo?.currency === moneda);
  const efectivo = convertirImporte(corredor === 'WEBULL' ? datos.total_cash_balance : datos.cash);
  const valorCuenta = convertirImporte(
    corredor === 'WEBULL' ? datos.total_net_liquidation_value : datos.portfolio_value ?? datos.portfolioValue
  );
  const poderCompra = convertirImporte(
    corredor === 'WEBULL' ? activos?.buying_power : datos.buying_power ?? datos.buyingPower
  );
  if (moneda === null && efectivo === null && valorCuenta === null && poderCompra === null) {
    throw boom.badGateway(mensajeFormatoInvalido);
  }
  return { currency: moneda, cash: efectivo, portfolioValue: valorCuenta, buyingPower: poderCompra, source: origen };
}

export async function consultarPosicionesConfirmadas(corredor) {
  const { datos } = await consultarBrokerConfirmado(corredor, 'positions');
  if (!Array.isArray(datos)) throw boom.badGateway(mensajeFormatoInvalido);

  return datos.map((posicion) => {
    const identificador = posicion?.asset_id ?? posicion?.position_id ?? posicion?.assetId
      ?? posicion?.instrument_id ?? posicion?.tickerId;
    const idInstrumento = Number.isFinite(identificador) ? String(identificador) : leerTexto(identificador);
    const simbolo = leerTexto(posicion?.symbol) ?? leerTexto(posicion?.ticker?.symbol);
    const cantidad = convertirImporte(posicion?.qty ?? posicion?.quantity ?? posicion?.position);
    if ((!idInstrumento && !simbolo) || cantidad === null) throw boom.badGateway(mensajeFormatoInvalido);

    const ladoProveedor = leerTexto(posicion.side)?.toLowerCase();
    const lado = ['long', 'short'].includes(ladoProveedor) ? ladoProveedor : (
      cantidad < 0 ? 'short' : corredor === 'IBKR' ? 'long' : null
    );
    return { assetId: idInstrumento, symbol: simbolo, qty: cantidad, side: lado };
  }).filter((posicion) => posicion.qty !== 0);
}
