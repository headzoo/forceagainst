import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CivicDistrictError,
  classifyCivicResponse,
  normalizeStreetAddress,
  parseCivicDistrict,
  senateAppliesToState,
} from '../lib/civic-district';

test('parses a numbered congressional district from Civic divisions', () => {
  assert.deepEqual(parseCivicDistrict({
    divisions: {
      'ocd-division/country:us/state:ny': {},
      'ocd-division/country:us/state:ny/cd:12': {},
    },
  }), { state: 'NY', district: 12 });
});

test('normalizes Civic at-large aliases to district zero', () => {
  assert.deepEqual(parseCivicDistrict({
    divisions: {
      'ocd-division/country:us/state:ak/cd:0': {
        alsoKnownAs: ['ocd-division/country:us/state:ak/cd:1'],
      },
    },
  }), { state: 'AK', district: 0 });
});

test('parses an at-large territory division and excludes senators', () => {
  const district = parseCivicDistrict({
    divisions: {
      'ocd-division/country:us/state:pr/cd:0': {},
    },
  });

  assert.deepEqual(district, { state: 'PR', district: 0 });
  assert.equal(senateAppliesToState(district.state), false);
});

test('accepts complete street addresses but rejects partial, ZIP-only, and PO box inputs', () => {
  assert.equal(
    normalizeStreetAddress(' 1600 Pennsylvania Avenue NW, Washington, DC 20500 '),
    '1600 Pennsylvania Avenue NW, Washington, DC 20500',
  );
  assert.equal(
    normalizeStreetAddress('123 Main St, Springfield, IL 62701'),
    '123 Main St, Springfield, IL 62701',
  );

  assert.equal(normalizeStreetAddress('123 Main St'), null);
  assert.equal(normalizeStreetAddress('20500'), null);
  assert.equal(normalizeStreetAddress('20500-1234'), null);
  assert.equal(normalizeStreetAddress('Washington, DC'), null);
  assert.equal(normalizeStreetAddress('Springfield, IL'), null);
  assert.equal(normalizeStreetAddress('PO Box 123, Springfield, IL 62701'), null);
  assert.equal(normalizeStreetAddress('P.O. Box 456, Springfield, IL 62701'), null);
  assert.equal(normalizeStreetAddress('A'.repeat(241)), null);
});

test('classifies Civic errors without exposing provider details', () => {
  const cases: Array<[number, CivicDistrictError['code'], number]> = [
    [400, 'not_found', 422],
    [403, 'configuration', 503],
    [429, 'unavailable', 503],
    [500, 'unavailable', 503],
  ];

  for (const [providerStatus, code, status] of cases) {
    const error = classifyCivicResponse(providerStatus);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
  }
});
