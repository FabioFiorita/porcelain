import { EmptyCommitSelectionError } from '../errors/empty-commit-selection-error.ts';
import type { GitActionExpectation } from '../models/git-action-expectation.ts';
import type { GitActionIntent } from '../models/git-action-intent.ts';

export function commitSelectsPaths(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): void {
  if (
    intent.action === 'commit' &&
    intent.paths.length === 0 &&
    expected.inProgress !== 'merge'
  )
    throw new EmptyCommitSelectionError();
}
