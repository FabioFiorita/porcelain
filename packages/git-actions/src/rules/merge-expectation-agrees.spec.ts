import { describe, expect, it } from 'vitest';
import { mergeExpectationAgrees } from './merge-expectation-agrees.ts';

const mergeHeadOid = 'b'.repeat(40);

describe('mergeExpectationAgrees', () => {
  it('accepts a merge in progress together with its merge head', () => {
    expect(mergeExpectationAgrees({ inProgress: 'merge', mergeHeadOid })).toBe(
      true,
    );
  });

  it('accepts a worktree with neither a merge nor a merge head', () => {
    expect(mergeExpectationAgrees({})).toBe(true);
  });

  it('refuses a merge in progress without its merge head', () => {
    expect(mergeExpectationAgrees({ inProgress: 'merge' })).toBe(false);
  });

  it('refuses a merge head without a merge in progress', () => {
    expect(mergeExpectationAgrees({ mergeHeadOid })).toBe(false);
  });

  it('refuses a merge head during a rebase', () => {
    expect(mergeExpectationAgrees({ inProgress: 'rebase', mergeHeadOid })).toBe(
      false,
    );
  });
});
