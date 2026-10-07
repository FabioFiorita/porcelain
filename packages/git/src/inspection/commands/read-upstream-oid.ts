import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { runInspection } from './run-inspection.ts';

export const readUpstreamOid = Effect.fn('Git.readUpstreamOid')(function* (
  checkout: string,
  upstream: string,
  limits: GitLimits,
) {
  const output = yield* runInspection(
    checkout,
    ['rev-parse', '--verify', `${upstream}^{commit}`],
    limits,
    { maxBytes: limits.inspection.upstreamOidBytes },
  );
  return output.toString('utf8').trimEnd() || null;
});
