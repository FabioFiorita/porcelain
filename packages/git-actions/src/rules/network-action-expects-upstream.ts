import type { GitActionExpectation } from '../models/git-action-expectation.ts';
import type { GitActionIntent } from '../models/git-action-intent.ts';

export function networkActionExpectsUpstream(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): boolean {
  const network =
    intent.action === 'fetch' ||
    intent.action === 'pull' ||
    intent.action === 'push';
  return !network || expected.upstream !== undefined;
}
