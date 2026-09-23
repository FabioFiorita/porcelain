import { MergeExpectationMismatchError } from '../errors/merge-expectation-mismatch-error.ts';
import type { GitActionExpectation } from '../models/git-action-expectation.ts';

export function mergeExpectationAgrees(expected: GitActionExpectation): void {
  if (
    (expected.inProgress === 'merge') !==
    (expected.mergeHeadOid !== undefined)
  )
    throw new MergeExpectationMismatchError();
}
