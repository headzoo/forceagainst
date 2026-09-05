import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatPlaceStreetAddress,
  formatUsStreetFromComponents,
  mergeSuggestionWithPlace,
  normalizePlaceId,
  stripCountrySuffix,
} from '../lib/places-address';

test('formats a numbered US street address with city, state, and ZIP', () => {
  assert.equal(formatUsStreetFromComponents([
    { longText: '123', shortText: '123', types: ['street_number'] },
    { longText: 'Main Street', shortText: 'Main St', types: ['route'] },
    { longText: 'Springfield', shortText: 'Springfield', types: ['locality'] },
    { longText: 'Illinois', shortText: 'IL', types: ['administrative_area_level_1'] },
    { longText: '62701', shortText: '62701', types: ['postal_code'] },
  ]), '123 Main Street, Springfield, IL 62701');
});

test('formats a DC address using the state abbreviation', () => {
  assert.equal(formatUsStreetFromComponents([
    { longText: '1600', shortText: '1600', types: ['street_number'] },
    { longText: 'Pennsylvania Avenue Northwest', shortText: 'Pennsylvania Ave NW', types: ['route'] },
    { longText: 'Washington', shortText: 'Washington', types: ['locality'] },
    { longText: 'District of Columbia', shortText: 'DC', types: ['administrative_area_level_1'] },
    { longText: '20500', shortText: '20500', types: ['postal_code'] },
  ]), '1600 Pennsylvania Avenue Northwest, Washington, DC 20500');
});

test('appends a subpremise and ZIP+4 when present', () => {
  assert.equal(formatUsStreetFromComponents([
    { longText: '10', shortText: '10', types: ['street_number'] },
    { longText: 'Federal Place', shortText: 'Federal Pl', types: ['route'] },
    { longText: '4', shortText: '4', types: ['subpremise'] },
    { longText: 'Juneau', shortText: 'Juneau', types: ['locality'] },
    { longText: 'Alaska', shortText: 'AK', types: ['administrative_area_level_1'] },
    { longText: '99801', shortText: '99801', types: ['postal_code'] },
    { longText: '1234', shortText: '1234', types: ['postal_code_suffix'] },
  ]), '10 Federal Place #4, Juneau, AK 99801-1234');
});

test('rejects incomplete address components', () => {
  assert.equal(formatUsStreetFromComponents([
    { longText: 'Main Street', shortText: 'Main St', types: ['route'] },
    { longText: 'Springfield', shortText: 'Springfield', types: ['locality'] },
    { longText: 'Illinois', shortText: 'IL', types: ['administrative_area_level_1'] },
    { longText: '62701', shortText: '62701', types: ['postal_code'] },
  ]), null);
});

test('falls back to a stripped formatted address that includes a street number', () => {
  assert.equal(
    formatPlaceStreetAddress(undefined, '123 Main St, Springfield, IL 62701, USA'),
    '123 Main St, Springfield, IL 62701',
  );
  assert.equal(
    formatPlaceStreetAddress(undefined, 'Main St, Springfield, IL 62702, USA'),
    'Main St, Springfield, IL 62702',
  );
  assert.equal(stripCountrySuffix('Juneau, AK, United States'), 'Juneau, AK');
});

test('restores a missing street number from the selected suggestion', () => {
  const suggestion = {
    placeId: 'ChIJTest',
    primaryText: '123 Main St',
    secondaryText: 'Springfield, IL, USA',
  };

  assert.equal(
    mergeSuggestionWithPlace(suggestion, '123 Main Street, Springfield, IL 62701'),
    '123 Main Street, Springfield, IL 62701',
  );
  assert.equal(
    mergeSuggestionWithPlace(suggestion, 'Main St, Springfield, IL 62702'),
    '123 Main St, Springfield, IL 62702',
  );
  assert.equal(
    mergeSuggestionWithPlace(suggestion, null),
    '123 Main St, Springfield, IL',
  );
});

test('normalizes Places resource names to place IDs', () => {
  assert.equal(normalizePlaceId('places/ChIJN1t_tDeuEmsRUsoyG83frY4'), 'ChIJN1t_tDeuEmsRUsoyG83frY4');
  assert.equal(normalizePlaceId('not a place'), null);
});
