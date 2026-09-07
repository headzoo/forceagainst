import assert from 'node:assert/strict';
import test from 'node:test';
import { canRemoveOrganizationModerator } from '../lib/organization-moderation-policy';

const creator = { membershipId: 10, userId: 'creator', organizationId: 1 };
const earlyModerator = { membershipId: 20, userId: 'early', organizationId: 1 };
const laterModerator = { membershipId: 30, userId: 'later', organizationId: 1 };

test('a moderator can remove a moderator added after them', () => {
  assert.equal(canRemoveOrganizationModerator(earlyModerator, laterModerator, creator.userId), true);
});

test('a moderator cannot remove an earlier moderator', () => {
  assert.equal(canRemoveOrganizationModerator(laterModerator, earlyModerator, creator.userId), false);
});

test('the creator cannot be removed', () => {
  assert.equal(canRemoveOrganizationModerator(earlyModerator, creator, creator.userId), false);
});

test('memberships from another organization are never comparable', () => {
  assert.equal(canRemoveOrganizationModerator(
    earlyModerator,
    { ...laterModerator, organizationId: 2 },
    creator.userId,
  ), false);
});
