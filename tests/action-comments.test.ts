import assert from 'node:assert/strict';
import test from 'node:test';
import { nestActionComments, type ActionCommentView } from '../lib/action-comments';

function comment(id: number, parentId: number | null, depth: number): ActionCommentView {
  return {
    id,
    actionId: 1,
    parentId,
    depth,
    body: `Comment ${id}`,
    visibility: 'visible',
    reportedByViewer: false,
    createdAt: '2026-09-06T12:00:00.000Z',
    author: { id: 'user-1', name: 'Member', username: 'member', image: null },
  };
}

test('builds a four-level comment thread', () => {
  const threads = nestActionComments([
    comment(1, null, 0),
    comment(2, 1, 1),
    comment(3, 2, 2),
    comment(4, 3, 3),
  ]);

  assert.equal(threads.length, 1);
  assert.equal(threads[0].children[0].children[0].children[0].id, 4);
});

test('keeps malformed or over-depth replies visible as roots', () => {
  const threads = nestActionComments([
    comment(1, null, 0),
    comment(2, 1, 2),
    comment(3, 2, 4),
  ]);

  assert.deepEqual(threads.map((item) => item.id), [1, 2, 3]);
});
