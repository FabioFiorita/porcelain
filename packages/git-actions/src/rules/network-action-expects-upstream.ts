import { MissingUpstreamExpectationError } from '../errors/missing-upstream-expectation-error.ts';
import type { GitActionExpectation } from '../models/git-action-expectation.ts';
import type { GitActionIntent } from '../models/git-action-intent.ts';

export function networkActionExpectsUpstream(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): void {
  const network =
    intent.action === 'fetch' ||
    intent.action === 'pull' ||
    intent.action === 'push';
  if (network && expected.upstream === undefined)
    throw new MissingUpstreamExpectationError();
}
