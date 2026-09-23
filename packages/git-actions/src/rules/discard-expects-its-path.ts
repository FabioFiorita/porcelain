import { DiscardExpectationMismatchError } from '../errors/discard-expectation-mismatch-error.ts';
import type { GitActionExpectation } from '../models/git-action-expectation.ts';
import type { GitActionIntent } from '../models/git-action-intent.ts';

export function discardExpectsItsPath(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): void {
  if (intent.action !== 'discard') return;
  const [only, ...others] = expected.files ?? [];
  if (only?.path !== intent.path || others.length > 0)
    throw new DiscardExpectationMismatchError();
}
