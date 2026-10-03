import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { CheckoutSession } from '../interfaces/git-session.ts';
import { parseSubmoduleStatus } from '../parsers/parse-submodule-status.ts';
import { runInspection } from './run-inspection.ts';

export async function readSubmoduleHeads(
  session: CheckoutSession,
  paths: readonly string[],
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths)];
  if (wanted.length === 0) return new Map();
  const output = await runInspection(
    session.path,
    ['submodule', 'status', '--', ...wanted],
    limits,
    signal,
    { maxBytes: limits.inspection.submoduleStatusBytes },
  );
  return parseSubmoduleStatus(output.toString('utf8'), wanted);
}
