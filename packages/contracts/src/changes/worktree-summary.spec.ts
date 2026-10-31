import { Schema } from 'effect';
import { expect, it } from 'vitest';
import { readWorktreeSummaryResponseSchema } from './git-status.ts';

const summary = {
  environmentId: '21c20d74-aee9-4293-b9d2-66b6a4d46c26',
  worktreeId: 'a'.repeat(32),
  additions: 3,
  deletions: 1,
  binaryFiles: 0,
};

it('accepts exact nonnegative line and binary totals', () => {
  expect(
    Schema.decodeUnknownSync(readWorktreeSummaryResponseSchema)(summary),
  ).toEqual(summary);
});

it.each(['additions', 'deletions', 'binaryFiles'])(
  'refuses negative %s totals at the wire boundary',
  (field) => {
    expect(() =>
      Schema.decodeUnknownSync(readWorktreeSummaryResponseSchema)({
        ...summary,
        [field]: -1,
      }),
    ).toThrow();
  },
);
