import { expect, it } from 'vitest';
import { commentHasOwner } from './comment-threads.ts';
const thread = {
  id: 'thread',
  worktreeId: 'worktree',
  anchor: { kind: 'file' as const, filePath: 'README.md' },
  messages: [],
  resolved: false,
  revision: 1,
};
it('keeps a thread with exactly its worktree or review owner even after the publishing worktree disappears', () => {
  expect(commentHasOwner(thread, { worktreeId: 'worktree' })).toBe(true);
  expect(commentHasOwner(thread, { worktreeId: 'other' })).toBe(false);
  expect(
    commentHasOwner(thread, { worktreeId: 'worktree', reviewId: 'review' }),
  ).toBe(false);
  const owned = {
    ...thread,
    review: { reviewId: 'review', revision: 2, headOid: 'a'.repeat(40) },
  };
  expect(
    commentHasOwner(owned, { worktreeId: 'removed', reviewId: 'review' }),
  ).toBe(true);
  expect(commentHasOwner(owned, { worktreeId: 'worktree' })).toBe(false);
  expect(
    commentHasOwner(owned, { worktreeId: 'worktree', reviewId: 'other' }),
  ).toBe(false);
});
