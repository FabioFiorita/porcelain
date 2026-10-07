import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { runInspection } from './run-inspection.ts';

export const readHeadCommit = Effect.fn('Git.readHeadCommit')(function* (
  checkout: string,
  headOid: string,
  limits: GitLimits,
) {
  const output = yield* runInspection(
    checkout,
    ['show', '-s', '--format=%s%x00%b', headOid],
    limits,
    { maxBytes: limits.inspection.headCommitBytes },
  );
  const [subject = '', body = ''] = output
    .toString('utf8')
    .trimEnd()
    .split('\0');
  return { subject, ...(body ? { body } : {}) };
});
