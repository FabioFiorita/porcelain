import type { GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessResult } from '../../shared/dtos/git-process-result.ts';

export function processFailure(
  result: GitProcessResult,
): GitActionOutcome | undefined {
  if (
    result.interrupted ||
    !result.descendantsStopped ||
    result.exitCode === null
  )
    return {
      state: 'indeterminate',
      reason: result.descendantsStopped
        ? 'OUTCOME_UNKNOWN'
        : 'PROCESS_GROUP_UNCONFIRMED',
      refreshRequired: result.started,
    };
  if (result.exitCode !== 0) {
    const message = result.stderr?.toString('utf8').trim();
    return {
      state: 'rejected',
      reason: 'GIT_REJECTED',
      ...(message ? { message } : {}),
      refreshRequired: result.started,
    };
  }
  return undefined;
}
