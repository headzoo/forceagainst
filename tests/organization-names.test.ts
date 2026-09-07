import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTO_IMPORTED_ORGANIZATION_NAME,
  AUTO_IMPORTED_ORGANIZATION_SLUG,
  organizationKey,
} from '../lib/organization-names';

test('auto-imported actions use one canonical organization identity', () => {
  assert.equal(AUTO_IMPORTED_ORGANIZATION_NAME, 'Supporters of Force');
  assert.equal(AUTO_IMPORTED_ORGANIZATION_SLUG, 'supporters-of-force');
});

test('organizationKey matches prefixed and unprefixed organization names', () => {
  assert.equal(organizationKey('Supporters of Disability Rights Education & Defense Fund'), organizationKey('Disability Rights Education and Defense Fund'));
});
