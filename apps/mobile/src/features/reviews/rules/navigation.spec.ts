import { expect, it } from 'vitest';
import {
  decodeCommentAnchor,
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
