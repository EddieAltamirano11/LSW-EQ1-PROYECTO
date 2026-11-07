import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { calculateBlackScholes, calculateImpliedVolatility, simulateF0F2Hedging } from '../src/api/v1/services/quant.service.js';
import { validateBlackScholesInput } from '../src/api/v1/validators/black-scholes.validator.js';
import { valuateBlackScholes } from '../src/api/v1/controllers/quant.controller.js';

const input = { spotPrice: 100, strikePrice: 100, timeToExpirationYears: 1, riskFreeRate: 0.05, volatility: 0.2 };

test('[unitaria] CALL coincide con la referencia independiente 10.4506', () => {
  const result = calculateBlackScholes({ ...input, optionType: 'CALL' });
  assert.equal(result.theoreticalPrice, 10.4506);
  assert.equal(result.greeks.delta, 0.6368);
});

test('[unitaria] CALL y PUT cumplen paridad con tolerancia de redondeo', () => {
  const call = calculateBlackScholes({ ...input, optionType: 'CALL' });
  const put = calculateBlackScholes({ ...input, optionType: 'PUT' });
  const parity = 100 - 100 * Math.exp(-0.05);
  assert.ok(Math.abs(call.theoreticalPrice - put.theoreticalPrice - parity) < 0.0002);
  assert.ok(Math.abs(call.greeks.delta - put.greeks.delta - 1) < 0.0002);
});

test('[unitaria] el precio CALL aumenta con el precio del subyacente', () => {
  const low = calculateBlackScholes({ ...input, spotPrice: 90, optionType: 'CALL' });
  const high = calculateBlackScholes({ ...input, spotPrice: 110, optionType: 'CALL' });
  assert.ok(high.theoreticalPrice > low.theoreticalPrice);
});

test('[unitaria] volatilidad implícita recupera el 20 por ciento de una referencia', () => {
  const result = calculateImpliedVolatility({ ...input, optionType: 'CALL', marketPrice: 10.4506 });
  assert.equal(result.converged, true);
  assert.ok(Math.abs(result.impliedVolatility - 0.2) < 0.0002);
});

test('[unitaria] collar limita pérdidas y ganancias en tres escenarios', () => {
  const strategy = { id: 'TEST-COLLAR', underlying: { spotPriceAtEntry: 100, sharesCount: 100 }, legs: [
    { legRole: 'HEDGE_FLOOR', strike: 95, entryPrice: 3 },
    { legRole: 'FINANCE_CEILING', strike: 110, entryPrice: 2 },
  ] };
  for (const [futureSpotF2, expected] of [[70, -600], [100, -100], [140, 900]]) {
    const result = simulateF0F2Hedging(strategy, { futureSpotF2 });
    assert.equal(result.comparativePayoff.hedgedStrategy.totalPLUSD, expected);
  }
});

test('[unitaria] validador normaliza sin modificar el objeto original', () => {
  const original = { ...input, spotPrice: '100', optionType: 'call', extra: 'ignorar' };
  const snapshot = structuredClone(original);
  const normalized = validateBlackScholesInput(original);
  assert.equal(normalized.spotPrice, 100);
  assert.equal(normalized.optionType, 'CALL');
  assert.equal(normalized.extra, undefined);
  assert.deepEqual(original, snapshot);
});

test('[unitaria] controlador aislado devuelve 200 mediante mocks de respuesta', async () => {
  const res = { status: mock.fn(function () { return this; }), json: mock.fn() };
  const next = mock.fn();
  await valuateBlackScholes({ body: { ...input, optionType: 'CALL' } }, res, next);
  assert.equal(res.status.mock.calls[0].arguments[0], 200);
  assert.equal(res.json.mock.calls[0].arguments[0].theoreticalPrice, 10.4506);
  assert.equal(next.mock.callCount(), 0);
});

test('[unitaria] controlador deriva el error a next sin responder éxito', async () => {
  const res = { status: mock.fn(), json: mock.fn() };
  const next = mock.fn();
  await valuateBlackScholes({ body: { ...input, spotPrice: -1 } }, res, next);
  assert.equal(next.mock.callCount(), 1);
  assert.equal(next.mock.calls[0].arguments[0].output.statusCode, 400);
  assert.equal(res.status.mock.callCount(), 0);
});
