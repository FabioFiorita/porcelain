import type { GitActionExpectation } from '../models/git-action-expectation.ts';
import type { GitActionIntent } from '../models/git-action-intent.ts';

export function expectsWholeChangeList(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): boolean {
  return (
    intent.action.startsWith('stash-') ||
    (intent.action === 'commit' && expected.inProgress === 'merge')
  );
}
