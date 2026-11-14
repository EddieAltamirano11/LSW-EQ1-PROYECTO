import { strict as assert } from 'node:assert';
import test from 'node:test';
import { assertObservedFeed, mapConcurrent, number, pages, SourceError, uniqueBy, within } from '../src/api/v2/services/strategyScreener/observations.js';

test('las observaciones conservan cero y respetan el corte y la ventana', () => {
  assert.equal(number('0'), 0);
  assert.equal(number(null), null);
  assert.equal(number(' '), null);
  assert.equal(within('2026-11-11T21:00:00Z', Date.parse('2026-11-11T20:00:00Z'), Date.parse('2026-11-11T20:59:59Z')), false);
  assert.equal(within('2026-11-11T19:00:00Z', Date.parse('2026-11-11T20:00:00Z'), Date.parse('2026-11-11T21:00:00Z')), false);
  assert.equal(within('2026-11-11T21:00:00Z', Date.parse('2026-11-11T20:00:00Z'), Date.parse('2026-11-11T21:00:00Z')), true);
  assert.throws(() => assertObservedFeed('Alpaca', 'indicative'), SourceError);
  assert.throws(() => assertObservedFeed('Webull', 'simulated'), SourceError);
  assert.doesNotThrow(() => assertObservedFeed('Alpaca', 'iex'));
});

test('recorre las páginas, deduplica registros y reporta cursores incompletos', async () => {
  const items = await pages('Proveedor', async cursor => cursor
    ? { items: [{ id: 1 }, { id: 2 }] }
    : { items: [{ id: 1 }], cursor: 'page2' });
  assert.deepEqual(uniqueBy(items, item => item.id), [{ id: 1 }, { id: 2 }]);
  await assert.rejects(() => pages('Proveedor', async () => ({ items: [], cursor: 'repetido' })), SourceError);
  let active = 0;
  const processed = await mapConcurrent([1, 2, 3, 4], 2, async value => {
    assert.ok(++active <= 2);
    await Promise.resolve();
    active--;
    return value * 2;
  });
  assert.deepEqual(processed, [2, 4, 6, 8]);
});
