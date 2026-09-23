import { MergeExpectationMismatchError } from '@porcelain/git-actions/errors';
import { describe, expect, it } from 'vitest';
import { mergeExpectationAgrees } from './merge-expectation-agrees.ts';

const mergeHeadOid = 'b'.repeat(40);

describe('mergeExpectationAgrees', () => {
  it('accepts a merge in progress together with its merge head', () => {
    expect(() =>
      mergeExpectationAgrees({ inProgress: 'merge', mergeHeadOid }),
    ).not.toThrow();
  });

  it('accepts a worktree with neither a merge nor a merge head', () => {
    expect(() => mergeExpectationAgrees({})).not.toThrow();
  });

  it('refuses a merge in progress without its merge head', () => {
    expect(() => mergeExpectationAgrees({ inProgress: 'merge' })).toThrow(
      MergeExpectationMismatchError,
    );
  });

  it('refuses a merge head without a merge in progress', () => {
    expect(() => mergeExpectationAgrees({ mergeHeadOid })).toThrow(
      MergeExpectationMismatchError,
    );
  });

  it('refuses a merge head during a rebase', () => {
    expect(() =>
      mergeExpectationAgrees({ inProgress: 'rebase', mergeHeadOid }),
    ).toThrow(MergeExpectationMismatchError);
  });
});
