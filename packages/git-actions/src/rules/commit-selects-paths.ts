import type { GitActionExpectation } from '../models/git-action-expectation.ts';
import type { GitActionIntent } from '../models/git-action-intent.ts';

export function commitSelectsPaths(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): boolean {
  return (
    intent.action !== 'commit' ||
    intent.paths.length > 0 ||
    expected.inProgress === 'merge'
  );
}
