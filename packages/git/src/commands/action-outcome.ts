import type { GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessResult } from '../dtos/git-process-result.ts';

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
  if (result.exitCode !== 0)
    return {
      state: 'rejected',
      reason: 'GIT_REJECTED',
      refreshRequired: result.started,
    };
  return undefined;
}
