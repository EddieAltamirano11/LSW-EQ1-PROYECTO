import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evaluateCoveredOptionSell,
  parseOccParts,
  parseOccUnderlying,
} from '../src/utils/optionOrder.js';

test('parseOccParts descompone subyacente, fecha, tipo y strike', () => {
  assert.deepEqual(parseOccParts('KO261218C00100000'), {
    underlying: 'KO',
    dateCode: '261218',
    optionType: 'CALL',
    strike: 100,
  });
  assert.equal(parseOccUnderlying('AAPL270115P00310000'), 'AAPL');
  assert.equal(parseOccParts('AAPL'), null);
});

test('una venta sin acciones del subyacente no esta cubierta', () => {
  const coverage = evaluateCoveredOptionSell({
    contractSymbol: 'KO261218C00100000',
    qty: 1,
    positions: [],
  });

  assert.equal(coverage.ok, false);
  assert.equal(coverage.underlying, 'KO');
  assert.equal(coverage.requiredShares, 100);
  assert.equal(coverage.availableShares, 0);
});

test('100 acciones largas cubren una call vendida', () => {
  const coverage = evaluateCoveredOptionSell({
    contractSymbol: 'KO261218C00100000',
    qty: 1,
    positions: [{ symbol: 'KO', qty: 100, side: 'long' }],
  });

  assert.equal(coverage.ok, true);
  assert.equal(coverage.availableShares, 100);
});

test('menos de 100 acciones no cubren el contrato', () => {
  const coverage = evaluateCoveredOptionSell({
    contractSymbol: 'KO261218C00100000',
    qty: 1,
    positions: [{ symbol: 'KO', qty: 50, side: 'long' }],
  });

  assert.equal(coverage.ok, false);
  assert.equal(coverage.availableShares, 50);
});

test('una posicion corta del subyacente no cubre la call', () => {
  const coverage = evaluateCoveredOptionSell({
    contractSymbol: 'KO261218C00100000',
    qty: 1,
    positions: [{ symbol: 'KO', qty: 100, side: 'short' }],
  });

  assert.equal(coverage.ok, false);
  assert.equal(coverage.availableShares, 0);
});

test('dos contratos exigen 200 acciones', () => {
  const coverage = evaluateCoveredOptionSell({
    contractSymbol: 'KO261218C00100000',
    qty: 2,
    positions: [{ symbol: 'KO', qty: 100, side: 'long' }],
  });

  assert.equal(coverage.ok, false);
  assert.equal(coverage.requiredShares, 200);
});

test('vender un contrato que ya se tiene largo es un cierre valido', () => {
  const coverage = evaluateCoveredOptionSell({
    contractSymbol: 'KO261218C00100000',
    qty: 1,
    positions: [{ symbol: 'KO261218C00100000', qty: 1, side: 'long' }],
  });

  assert.equal(coverage.ok, true);
  assert.equal(coverage.closesLongOption, true);
  assert.equal(coverage.requiredShares, 0);
});

test('evaluateCoveredOptionSell ignora simbolos que no son OCC', () => {
  assert.equal(evaluateCoveredOptionSell({ contractSymbol: 'AAPL', qty: 1 }), null);
  assert.equal(evaluateCoveredOptionSell({ contractSymbol: 'KO261218C00100000', qty: 0 }), null);
});
