import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveActionCommentModerationPermissions } from './comment-moderation-policy';

test('the action submitter can moderate only that action when they are not the organization owner', () => {
  assert.deepEqual(resolveActionCommentModerationPermissions({
    submittedByUserId: 'submitter',
    ownerUserId: 'owner',
  }, 'submitter'), {
    canModerate: true,
    canBanOrganization: false,
  });
});

test('the organization owner can moderate the action and apply organization-wide bans', () => {
  assert.deepEqual(resolveActionCommentModerationPermissions({
    submittedByUserId: 'submitter',
    ownerUserId: 'owner',
  }, 'owner'), {
    canModerate: true,
    canBanOrganization: true,
  });
});

test('other members receive no moderation permissions', () => {
  assert.deepEqual(resolveActionCommentModerationPermissions({
    submittedByUserId: 'submitter',
    ownerUserId: 'owner',
  }, 'member'), {
    canModerate: false,
    canBanOrganization: false,
  });
});
