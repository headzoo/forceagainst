import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStoredGovernmentLookup } from '../lib/government-lookup-storage';

const now = Date.parse('2026-09-06T12:00:00.000Z');

test('accepts a current representative lookup without an address', () => {
  const stored = parseStoredGovernmentLookup({
    version: 2,
    jurisdiction: { state: 'AK', district: 0 },
    representativeId: 'P000001',
    senatorIds: ['S000001', 'S000002'],
    resolvedAt: '2026-09-05T12:00:00.000Z',
  }, now);

  assert.deepEqual(stored, {
    version: 2,
    jurisdiction: { state: 'AK', district: 0 },
    representativeId: 'P000001',
    senatorIds: ['S000001', 'S000002'],
    resolvedAt: '2026-09-05T12:00:00.000Z',
  });
  assert.equal('address' in (stored ?? {}), false);
});

test('migrates the previous address-bearing lookup without retaining the address', () => {
  const stored = parseStoredGovernmentLookup({
    address: '123 Main St, Anchorage, AK 99501',
    result: {
      jurisdiction: { state: 'AK', district: 0 },
      representative: { bioguideId: 'P000001' },
      senators: [{ bioguideId: 'S000001' }, { bioguideId: 'S000002' }],
    },
  }, now);

  assert.equal(stored?.representativeId, 'P000001');
  assert.deepEqual(stored?.senatorIds, ['S000001', 'S000002']);
  assert.equal('address' in (stored ?? {}), false);
});

test('expires representative lookups after thirty days', () => {
  const stored = parseStoredGovernmentLookup({
    version: 2,
    jurisdiction: { state: 'AK', district: 0 },
    representativeId: 'P000001',
    senatorIds: ['S000001', 'S000002'],
    resolvedAt: '2026-07-01T12:00:00.000Z',
  }, now);

  assert.equal(stored, null);
});

