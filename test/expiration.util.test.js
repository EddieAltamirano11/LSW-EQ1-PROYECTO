import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildOccSymbol,
  isExpiredOptionSymbol,
  isOccSymbol,
  nextValidExpiration,
  occDateCode,
  parseOccExpiration,
  thirdFridayOfMonth,
  toExpirationDateString,
} from '../src/utils/expiration.js';
import { createBrokerOrder } from '../src/api/v1/services/broker.service.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const daysBetween = (a, b) => (b.getTime() - a.getTime()) / MS_PER_DAY;

test('nextValidExpiration devuelve un viernes de vencimiento a 30 dias o mas', () => {
  const from = new Date('2026-11-03T12:00:00Z');
  const expiration = nextValidExpiration({ from });

  assert.equal(expiration, '2026-12-18');
  const date = new Date(`${expiration}T00:00:00Z`);
  assert.equal(date.getUTCDay(), 5, 'debe ser viernes');
  assert.ok(daysBetween(from, date) >= 30, 'debe estar a 30 dias o mas');
});

test('nextValidExpiration nunca devuelve una fecha pasada', () => {
  for (const from of ['2026-01-01', '2026-02-25', '2026-10-20', '2026-12-31', '2027-06-10']) {
    const base = new Date(`${from}T00:00:00Z`);
    const expiration = nextValidExpiration({ from: base });
    assert.ok(
      new Date(`${expiration}T00:00:00Z`).getTime() > base.getTime(),
      `la expiracion ${expiration} debe ser posterior a ${from}`
    );
  }
});

test('thirdFridayOfMonth calcula el tercer viernes', () => {
  assert.equal(thirdFridayOfMonth(2027, 0).toISOString().slice(0, 10), '2027-01-15');
  assert.equal(thirdFridayOfMonth(2026, 11).toISOString().slice(0, 10), '2026-12-18');
});

test('toExpirationDateString normaliza ISO completo a YYYY-MM-DD', () => {
  assert.equal(toExpirationDateString('2027-01-15T00:00:00.000Z'), '2027-01-15');
  assert.equal(toExpirationDateString('2027-01-15'), '2027-01-15');
  assert.equal(toExpirationDateString('no-es-fecha'), null);
});

test('occDateCode y buildOccSymbol generan simbolos OCC correctos', () => {
  assert.equal(occDateCode('2027-01-15'), '270115');
  assert.equal(occDateCode('2027-01-15T00:00:00Z'), '270115');
  assert.equal(buildOccSymbol('KO', '2027-01-15', 'PUT', 90), 'KO270115P00090000');
  assert.equal(buildOccSymbol('ko', '2027-01-15T00:00:00Z', 'CALL', 105), 'KO270115C00105000');
});

test('parseOccExpiration extrae la fecha del simbolo', () => {
  assert.equal(parseOccExpiration('KO261016P00090000').toISOString().slice(0, 10), '2026-10-16');
  assert.equal(parseOccExpiration('AAPL270115C00310000').toISOString().slice(0, 10), '2027-01-15');
  assert.equal(parseOccExpiration('AAPL'), null);
});

test('isOccSymbol distingue simbolos OCC de tickers simples', () => {
  assert.equal(isOccSymbol('KO261016P00090000'), true);
  assert.equal(isOccSymbol('AAPL'), false);
  assert.equal(isOccSymbol(''), false);
});

test('isExpiredOptionSymbol detecta contratos vencidos', () => {
  const now = new Date('2026-11-03T00:00:00Z');
  assert.equal(isExpiredOptionSymbol('KO261016P00090000', now), true);
  assert.equal(isExpiredOptionSymbol('AAPL270115P00310000', now), false);
  assert.equal(isExpiredOptionSymbol('AAPL', now), false);
});

test('createBrokerOrder rechaza con 400 un contrato OCC vencido', async () => {
  await assert.rejects(
    () => createBrokerOrder({ symbol: 'KO261016P00090000', qty: 1, side: 'buy' }, 'ALPACA'),
    (error) => {
      assert.equal(error.output?.statusCode, 400);
      assert.match(error.message, /venció el 2026-10-16/);
      return true;
    }
  );
});

test('createBrokerOrder rechaza una fecha OCC imposible', async () => {
  await assert.rejects(
    () => createBrokerOrder({ symbol: 'KO269916P00090000', qty: 1, side: 'buy' }, 'ALPACA'),
    (error) => {
      assert.equal(error.output?.statusCode, 400);
      return true;
    }
  );
});
