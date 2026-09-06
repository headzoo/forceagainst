import assert from 'node:assert/strict';
import test from 'node:test';
import { contentVoter } from '../lib/comment-voters/content-voter';
import { hashNormalizedCommentBody, normalizeCommentBody } from '../lib/comment-voters/normalize';
import { runCommentVoters } from '../lib/comment-voters/run';
import type { CommentVoterContext } from '../lib/comment-voters/types';

const now = new Date('2026-09-06T12:00:00.000Z');

function context(overrides: Partial<CommentVoterContext> = {}): CommentVoterContext {
  const body = overrides.body ?? 'A useful contribution';
  const normalizedBody = overrides.normalizedBody ?? normalizeCommentBody(body);
  return {
    actionId: 1,
    body,
    normalizedBody,
    normalizedBodyHash: hashNormalizedCommentBody(normalizedBody),
    now,
    user: {
      id: 'member-1',
      emailVerified: true,
      createdAt: new Date('2026-09-01T12:00:00.000Z'),
    },
    ...overrides,
  };
}

test('normalizes whitespace, compatibility characters, and invisible characters consistently', () => {
  assert.equal(normalizeCommentBody('  ＨELLO\u200b   world  '), 'hello world');
  assert.equal(
    hashNormalizedCommentBody(normalizeCommentBody('Hello world')),
    hashNormalizedCommentBody(normalizeCommentBody(' ＨELLO\u200b  world ')),
  );
});

test('the voter runner stops after the first rejection', async () => {
  const visited: string[] = [];
  const vote = await runCommentVoters([
    { name: 'first', async vote() { visited.push('first'); return { decision: 'pass' }; } },
    { name: 'second', async vote() { visited.push('second'); return { decision: 'reject', code: 'NO', message: 'Rejected', status: 400 }; } },
    { name: 'third', async vote() { visited.push('third'); return { decision: 'pass' }; } },
  ], context());

  assert.equal(vote.decision, 'reject');
  assert.deepEqual(visited, ['first', 'second']);
});

test('new accounts cannot put several links in one comment', async () => {
  const body = 'See https://example.com and https://example.org';
  const vote = await contentVoter.vote(context({
    body,
    normalizedBody: normalizeCommentBody(body),
    user: {
      id: 'new-member',
      emailVerified: true,
      createdAt: new Date('2026-09-06T11:30:00.000Z'),
    },
  }));

  assert.deepEqual(vote, {
    decision: 'reject',
    code: 'COMMENT_LINK_LIMIT',
    message: 'This comment contains too many links. New accounts can include one link.',
    status: 400,
  });
});

test('established accounts can include several distinct supporting links', async () => {
  const body = 'Sources: https://one.example/a https://two.example/b https://three.example/c';
  const vote = await contentVoter.vote(context({ body, normalizedBody: normalizeCommentBody(body) }));
  assert.deepEqual(vote, { decision: 'pass' });
});

test('comments made only from invisible characters are rejected', async () => {
  const body = '\u200b\u2060';
  const vote = await contentVoter.vote(context({ body, normalizedBody: normalizeCommentBody(body) }));
  assert.equal(vote.decision, 'reject');
  if (vote.decision === 'reject') assert.equal(vote.code, 'COMMENT_EMPTY');
});
