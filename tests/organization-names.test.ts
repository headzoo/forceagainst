import assert from 'node:assert/strict';
import test from 'node:test';
import { organizationKey, supportersName } from '../lib/organization-names';

test('supportersName adds exactly one canonical prefix', () => {
  assert.equal(supportersName('American Civil Liberties Union'), 'Supporters of American Civil Liberties Union');
  assert.equal(supportersName('supporters of  American Civil Liberties Union'), 'Supporters of American Civil Liberties Union');
});

test('organizationKey matches prefixed and unprefixed organization names', () => {
  assert.equal(organizationKey('Supporters of Disability Rights Education & Defense Fund'), organizationKey('Disability Rights Education and Defense Fund'));
});
