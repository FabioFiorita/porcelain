import { expect, it } from 'vitest';
import {
  reviewParams,
  reviewComparison,
  reviewFileDocumentKey,
} from './navigation';

it('keeps saved reading places of one path apart per review comparison', () => {
  expect(
    [
      { kind: 'worktree' as const },
      { kind: 'branch' as const },
      { kind: 'branch' as const, base: 'refs/heads/main' },
    ].map((comparison) => reviewFileDocumentKey('README.md', comparison)),
  ).toEqual([
    '["review-file",["worktree"],"README.md"]',
    '["review-file",["branch",null],"README.md"]',
    '["review-file",["branch","refs/heads/main"],"README.md"]',
  ]);
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
