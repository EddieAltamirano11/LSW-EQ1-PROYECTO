import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { test } from 'node:test';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import config from '../src/config/config.js';
import { startLoginServer } from './helpers/login-server.js';
import { getBrokerAccount, getBrokerPositions } from '../src/api/v1/services/broker.service.js';
import {
  consultarCuentaConfirmada,
  consultarPosicionesConfirmadas,
} from '../src/api/v1/services/portafolio.service.js';

function simularAlpaca(prueba, responder) {
  const configuracionOriginal = { ...config };
  Object.assign(config, {
    ALPACA_BASE_URL: 'https://paper-api.alpaca.markets',
    ALPACA_API_KEY_ID: 'clave-prueba',
    ALPACA_API_SECRET_KEY: 'secreto-prueba',
  });
  prueba.after(() => Object.assign(config, configuracionOriginal));
  return prueba.mock.method(axios, 'get', responder);
}

function simularPuente(prueba, responder) {
  const simulacion = prueba.mock.method(childProcess, 'spawnSync', responder);
  syncBuiltinESMExports();
  prueba.after(() => {
    simulacion.mock.restore();
    syncBuiltinESMExports();
  });
  return simulacion;
}

function salidaPuente(respuesta) {
  return { stdout: JSON.stringify(respuesta) };
}

function tieneEstado(estado) {
  return (error) => error.output?.statusCode === estado;
}

test('Alpaca distingue cero, cartera vacía, tiempo de espera y datos ilegibles', async (prueba) => {
  let cuenta = { currency: 'USD', cash: '0', portfolio_value: '125.50' };
  let posiciones = [];
  let falla = false;
  simularAlpaca(prueba, async (url, opciones) => {
    assert.equal(opciones.timeout, 5000);
    if (falla) throw new Error('Información interna del proveedor');
    return { data: url.endsWith('/account') ? cuenta : posiciones };
  });

  assert.deepEqual(await consultarCuentaConfirmada('ALPACA'), {
    currency: 'USD', cash: 0, portfolioValue: 125.5, buyingPower: null,
    source: 'Alpaca (paper trading)',
  });
  assert.deepEqual(await consultarPosicionesConfirmadas('ALPACA'), []);
  posiciones = [{ symbol: 'SPY', qty: '2.5', side: 'short' }];
  assert.deepEqual(await consultarPosicionesConfirmadas('ALPACA'), [
    { assetId: null, symbol: 'SPY', qty: 2.5, side: 'short' },
  ]);
  posiciones = [{ symbol: 'SPY', qty: '' }];
  cuenta = { currency: '', cash: false };
  await assert.rejects(consultarPosicionesConfirmadas('ALPACA'), tieneEstado(502));
  await assert.rejects(consultarCuentaConfirmada('ALPACA'), tieneEstado(502));

  falla = true;
  await assert.rejects(consultarCuentaConfirmada('ALPACA'), tieneEstado(503));
  await assert.rejects(consultarPosicionesConfirmadas('ALPACA'), tieneEstado(503));
  assert.match((await getBrokerAccount('ALPACA')).source, /Simulated/);
  assert.deepEqual(await getBrokerPositions('ALPACA'), []);
});

test('Webull utiliza los datos confirmados del puente y el poder de compra en la moneda de cuenta', async (prueba) => {
  let posiciones = [{ position_id: 'pos-1', symbol: 'AAPL', quantity: '4' }];
  simularPuente(prueba, (_ejecutable, argumentos, opciones) => {
    assert.match(argumentos[0], /webull_desktop_bridge\.py$/);
    assert.equal(opciones.timeout, 15000);
    const [, comando, modo] = argumentos;
    if (!modo) return salidaPuente({ success: false });
    assert.equal(modo, '--strict');
    const cuenta = {
      total_asset_currency: 'USD', total_cash_balance: '0', total_net_liquidation_value: null,
      account_currency_assets: [
        { currency: 'CAD', buying_power: '100' },
        { currency: 'USD', buying_power: '0' },
      ],
    };
    return salidaPuente({
      success: true, data: comando === 'account' ? cuenta : posiciones,
      source: 'Webull OpenAPI (paper trading)',
    });
  });

  assert.deepEqual(await consultarCuentaConfirmada('WEBULL'), {
    currency: 'USD', cash: 0, portfolioValue: null, buyingPower: 0,
    source: 'Webull OpenAPI (paper trading)',
  });
  assert.deepEqual(await consultarPosicionesConfirmadas('WEBULL'), [
    { assetId: 'pos-1', symbol: 'AAPL', qty: 4, side: null },
  ]);
  posiciones = {};
  await assert.rejects(consultarPosicionesConfirmadas('WEBULL'), tieneEstado(502));
  assert.match((await getBrokerAccount('WEBULL')).source, /Virtual Feed/);
  assert.deepEqual(await getBrokerPositions('WEBULL'), []);
});

test('IBKR conserva los contratos individuales y rechaza arreglos de respaldo', async (prueba) => {
  let modo = 'LIVE_TWS_SOCKET';
  let posiciones = [
    { assetId: 42, symbol: 'AAPL', qty: 2 },
    { assetId: 43, symbol: 'AAPL', qty: -1 },
  ];
  simularPuente(prueba, (_ejecutable, argumentos) => {
    assert.match(argumentos[0], /ibkr_desktop_bridge\.py$/);
    const [, comando, opcion] = argumentos;
    if (!opcion) return salidaPuente({ success: true, positions: [] });
    assert.equal(opcion, '--strict');
    return salidaPuente({
      success: true, mode: modo,
      data: comando === 'account' ? { currency: 'USD', cash: '0' } : posiciones,
    });
  });
  assert.equal((await consultarCuentaConfirmada('IBKR')).cash, 0);
  assert.deepEqual(await consultarPosicionesConfirmadas('IBKR'), [
    { assetId: '42', symbol: 'AAPL', qty: 2, side: 'long' },
    { assetId: '43', symbol: 'AAPL', qty: -1, side: 'short' },
  ]);
  posiciones = [];
  assert.deepEqual(await consultarPosicionesConfirmadas('IBKR'), []);
  modo = 'DEFENSIVE_SANDBOX_FALLBACK';
  await assert.rejects(consultarPosicionesConfirmadas('IBKR'), tieneEstado(503));
  assert.deepEqual(await getBrokerPositions('IBKR'), []);
});

test('El servicio distingue errores de formato del puente y un proceso sin respuesta', async (prueba) => {
  simularPuente(prueba, (_ejecutable, argumentos) => argumentos[1] === 'positions'
    ? salidaPuente({ success: false, status: 502 })
    : { stdout: '', error: new Error('tiempo de espera') });
  await assert.rejects(consultarPosicionesConfirmadas('WEBULL'), tieneEstado(502));
  await assert.rejects(consultarCuentaConfirmada('WEBULL'), tieneEstado(503));
});

test('Las rutas de cuenta y posiciones exponen el modo estricto en v1 y v2', async (prueba) => {
  const servidor = await startLoginServer();
  prueba.after(servidor.close);
  let datosPosiciones = [];
  let proveedorDisponible = true;
  const simulacion = simularAlpaca(prueba, async (url) => {
    if (!proveedorDisponible) throw new Error('detalle privado del proveedor');
    return { data: url.endsWith('/account') ? { currency: 'USD', cash: '0' } : datosPosiciones };
  });
  const tokenSesion = jwt.sign({ sub: 'portafolio', dbTarget: 'mongodb' }, config.JWT_SECRET);
  const autorizacion = { Authorization: `Bearer ${tokenSesion}` };
  const encabezados = { ...autorizacion, 'x-broker-selection': 'ALPACA' };
  const urlCuenta = `${servidor.origin}/api/v2/broker/account?strict=true`;
  const urlPosiciones = `${servidor.origin}/api/v1/broker/positions?strict=true`;

  assert.equal((await fetch(urlCuenta)).status, 401);
  assert.equal((await fetch(urlPosiciones, {
    headers: { ...encabezados, Authorization: 'Bearer invalido' },
  })).status, 401);
  assert.equal((await fetch(`${urlCuenta}&broker=ALPACA`, { headers: autorizacion })).status, 400);
  assert.equal((await fetch(urlPosiciones, {
    headers: { ...autorizacion, 'x-broker-selection': 'SIMULATED' },
  })).status, 400);
  assert.equal(simulacion.mock.callCount(), 0);

  const cuenta = await fetch(`${urlCuenta}&broker=IBKR`, { headers: encabezados });
  assert.equal(cuenta.status, 200);
  assert.equal(cuenta.headers.get('x-active-broker'), 'ALPACA');
  assert.equal(cuenta.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await cuenta.json(), {
    broker: 'ALPACA',
    account: { currency: 'USD', cash: 0, portfolioValue: null, buyingPower: null, source: 'Alpaca (paper trading)' },
  });
  assert.deepEqual(await (await fetch(urlPosiciones, { headers: encabezados })).json(), {
    broker: 'ALPACA', positions: [],
  });

  datosPosiciones = {};
  assert.equal((await fetch(urlPosiciones, { headers: encabezados })).status, 502);
  proveedorDisponible = false;
  const errorCuenta = await fetch(urlCuenta, { headers: encabezados });
  assert.equal(errorCuenta.status, 503);
  const cuerpoError = await errorCuenta.json();
  assert.equal(cuerpoError.statusCode, 503);
  assert.equal(cuerpoError.account, undefined);
  assert.doesNotMatch(JSON.stringify(cuerpoError), /detalle privado/);

  const respuestaHabitual = await fetch(`${servidor.origin}/api/v2/broker/account?broker=ALPACA`);
  assert.equal(respuestaHabitual.status, 200);
  const cuentaHabitual = await respuestaHabitual.json();
  assert.match(cuentaHabitual.source, /Simulated/);
  assert.equal(cuentaHabitual.account, undefined);
  const posicionesHabituales = await fetch(`${servidor.origin}/api/v1/broker/positions?broker=ALPACA`);
  assert.equal(posicionesHabituales.status, 200);
  assert.deepEqual(await posicionesHabituales.json(), []);
});
