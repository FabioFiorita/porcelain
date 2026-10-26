import { expect, it } from 'vitest';
import {
  commentReviewParams,
  decodeCommentAnchor,
  decodeCommentReview,
  reviewParams,
  reviewComparison,
} from './navigation';

it('preserves a valid deleted-line anchor when opening the native sheet', () => {
  expect(
    decodeCommentAnchor(
      '{"kind":"codeRange","filePath":"README.md","startLine":3,"endLine":4,"side":"deletions","comparison":{"kind":"worktree","scope":"staged"},"contentFingerprint":"observed"}',
    ),
  ).toEqual({
    kind: 'codeRange',
    filePath: 'README.md',
    startLine: 3,
    endLine: 4,
    side: 'deletions',
    comparison: { kind: 'worktree', scope: 'staged' },
    contentFingerprint: 'observed',
  });
});

it.each([
  '{"kind":"codeRange","filePath":"README.md","startLine":0,"endLine":4}',
  '{"kind":"file","filePath":"../outside"}',
  '{"kind":"file","filePath":"README.md","comparison":{"kind":"worktree","scope":"unmerged"}}',
  '{invalid',
])('refuses an invalid sheet anchor: %s', (value) => {
  expect(decodeCommentAnchor(value)).toBeUndefined();
});

it('binds a branch file route to its workspace and selected base', () => {
  expect(
    reviewParams('remote-and-worktree', {
      kind: 'branch',
      base: 'refs/heads/main',
    }),
  ).toEqual({
    workspace: 'remote-and-worktree',
    comparison: 'branch',
    base: 'refs/heads/main',
  });
});

it('preserves a branch base and accepts a branch without a chosen base', () => {
  expect(reviewComparison('branch', 'refs/heads/main')).toEqual({
    kind: 'branch',
    base: 'refs/heads/main',
  });
  expect(reviewComparison('branch')).toEqual({ kind: 'branch' });
});
it.each([undefined, 'worktree', 'unknown'])(
  'defaults %s to a worktree comparison',
  (kind) => {
    expect(reviewComparison(kind, 'ignored')).toEqual({ kind: 'worktree' });
  },
);

const reviewId = '92825267-1e53-4a39-a954-9c6920e57ffa';

it('carries the published review a new comment belongs to into the comments page', () => {
  const params = commentReviewParams({ reviewId, revision: 3 });
  expect(params).toEqual({ review: reviewId, revision: '3' });
  expect(decodeCommentReview(params.review, params.revision)).toEqual({
    reviewId,
    reviewRevision: 3,
  });
});

it('leaves a comment on a publication without a durable review unowned', () => {
  expect(commentReviewParams({ revision: 3 })).toEqual({});
  expect(decodeCommentReview(undefined, undefined)).toBeUndefined();
});

it.each(['0', '-1', '1.5', 'r2', undefined])(
  'refuses review revision %s',
  (revision) => {
    expect(decodeCommentReview(reviewId, revision)).toBeUndefined();
  },
);
