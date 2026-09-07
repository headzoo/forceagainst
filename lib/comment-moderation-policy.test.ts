import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveActionCommentModerationPermissions } from './comment-moderation-policy';

test('the action submitter can moderate only that action when they are not an organization moderator', () => {
  assert.deepEqual(resolveActionCommentModerationPermissions({
    submittedByUserId: 'submitter',
    isOrganizationModerator: false,
  }, 'submitter'), {
    canModerate: true,
    canBanOrganization: false,
  });
});

test('an organization moderator can moderate the action and apply organization-wide bans', () => {
  assert.deepEqual(resolveActionCommentModerationPermissions({
    submittedByUserId: 'submitter',
    isOrganizationModerator: true,
  }, 'moderator'), {
    canModerate: true,
    canBanOrganization: true,
  });
});

test('other users receive no moderation permissions', () => {
  assert.deepEqual(resolveActionCommentModerationPermissions({
    submittedByUserId: 'submitter',
    isOrganizationModerator: false,
  }, 'member'), {
    canModerate: false,
    canBanOrganization: false,
  });
});
