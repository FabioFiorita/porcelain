import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { runInspection } from './run-inspection.ts';

export async function readUpstreamOid(
  checkout: string,
  upstream: string,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<string | null> {
  const output = await runInspection(
    checkout,
    ['rev-parse', '--verify', `${upstream}^{commit}`],
    limits,
    signal,
    { maxBytes: limits.inspection.upstreamOidBytes },
  );
  return output.toString('utf8').trimEnd() || null;
}
