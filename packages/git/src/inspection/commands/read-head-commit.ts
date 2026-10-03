import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { runInspection } from './run-inspection.ts';

export async function readHeadCommit(
  checkout: string,
  headOid: string,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<{ subject: string; body?: string }> {
  const output = await runInspection(
    checkout,
    ['show', '-s', '--format=%s%x00%b', headOid],
    limits,
    signal,
    { maxBytes: limits.inspection.headCommitBytes },
  );
  const [subject = '', body = ''] = output
    .toString('utf8')
    .trimEnd()
    .split('\0');
  return { subject, ...(body ? { body } : {}) };
}
