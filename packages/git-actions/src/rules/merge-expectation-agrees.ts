import type { GitActionExpectation } from '../models/git-action-expectation.ts';

export function mergeExpectationAgrees(
  expected: GitActionExpectation,
): boolean {
  return (
    (expected.inProgress === 'merge') === (expected.mergeHeadOid !== undefined)
  );
}
