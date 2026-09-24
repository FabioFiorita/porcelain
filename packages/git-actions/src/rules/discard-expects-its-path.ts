import type { GitActionExpectation } from '../models/git-action-expectation.ts';
import type { GitActionIntent } from '../models/git-action-intent.ts';

export function discardExpectsItsPath(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): boolean {
  if (intent.action !== 'discard') return true;
  const [only, ...others] = expected.files ?? [];
  return only?.path === intent.path && others.length === 0;
}
