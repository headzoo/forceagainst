import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeUsername, usernameError } from '../lib/username';

test('normalizes usernames to a stable lowercase value', () => {
  assert.equal(normalizeUsername('  Action_User  '), 'action_user');
});

test('accepts supported usernames and rejects invalid values', () => {
  assert.equal(usernameError('action_user2'), null);
  assert.match(usernameError('ab') ?? '', /3–24/);
  assert.match(usernameError('action-user') ?? '', /letters, numbers, and underscores/);
});
