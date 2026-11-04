import { expect, it } from 'vitest';
import {
  commentHasOwner,
  commentOwner,
  repeatsCreation,
} from './comment-threads.ts';
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

it('selects the durable review owner instead of the publishing worktree for saved review comments', () => {
  expect(
    commentOwner({
      worktreeId: 'publishing-worktree',
      review: {
        reviewId: 'saved-review',
        revision: 2,
        headOid: 'a'.repeat(40),
      },
    }),
  ).toEqual({ reviewId: 'saved-review' });
  expect(commentOwner({ worktreeId: 'publishing-worktree' })).toEqual({
    worktreeId: 'publishing-worktree',
  });
});

it('refuses a comment retry that retargets the same identity to another decision', () => {
  const anchor = {
    kind: 'change' as const,
    reviewTarget: { kind: 'decision' as const, id: 'one' },
  };
  const saved = {
    ...thread,
    anchor,
    messages: [
      { id: 'message', body: 'Teach me', author: 'reviewer' as const },
    ],
  };
  const attempt = {
    worktreeId: 'worktree',
    anchor,
    messageId: 'message',
    body: 'Teach me',
    author: 'reviewer' as const,
  };
  expect(repeatsCreation(saved, attempt)).toBe(true);
  expect(
    repeatsCreation(saved, {
      ...attempt,
      anchor: { ...anchor, reviewTarget: { kind: 'decision', id: 'two' } },
    }),
  ).toBe(false);
});
