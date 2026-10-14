import { expect, it } from 'vitest';
import { Option, Schema } from 'effect';
import { reviewComparisonSchema } from './review-comparison';

it('restores uncommitted, default-base and explicit-base comparisons', () => {
  const decode = Schema.decodeUnknownSync(reviewComparisonSchema);
  expect(decode({ kind: 'worktree' })).toEqual({ kind: 'worktree' });
  expect(decode({ kind: 'branch' })).toEqual({ kind: 'branch' });
  expect(decode({ kind: 'branch', base: 'refs/heads/main' })).toEqual({
    kind: 'branch',
    base: 'refs/heads/main',
  });
});

it('rejects unknown comparisons and a non-string branch base at the saved-layout boundary', () => {
  const decode = Schema.decodeUnknownOption(reviewComparisonSchema);
  expect(decode({ kind: 'staged' })).toEqual(Option.none());
  expect(decode({ kind: 'branch', base: 4 })).toEqual(Option.none());
});
