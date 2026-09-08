import type { GitActionOutcome } from '../dtos/git-action.ts';
import type { GitActionSnapshot } from '../dtos/git-action-snapshot.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from './action-outcome.ts';
import { readActionCommand } from './read-action-command.ts';

export async function removeAppliedStash(
  process: GitProcessRunner,
  stashOid: string,
  snapshot: GitActionSnapshot,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  const result = { stashOid, stashRetained: true };
  // Git has no atomic delete-by-OID for a stash reflog. Revalidate immediately;
  // trusted external writers must remain paused through this multi-step operation.
  const current = await readActionCommand(
    process,
    ['stash', 'list', '--format=%H%x00%gd%x00%gs'],
    signal,
  );
  const entries = current.trimEnd().split('\n');
  const selected = entries.filter((entry) => entry.split('\0')[0] === stashOid);
  if (current !== snapshot.stashLog || selected.length !== 1)
    return {
      state: 'indeterminate',
      reason: 'OUTCOME_UNKNOWN',
      result,
      refreshRequired: true,
    };
  const selector = selected[0]?.split('\0')[1];
  if (!selector || !/^stash@\{[0-9]+\}$/.test(selector))
    return {
      state: 'indeterminate',
      reason: 'OUTCOME_UNKNOWN',
      result,
      refreshRequired: true,
    };
  const dropped = await process.execute(['stash', 'drop', selector], signal);
  const dropFailure = processFailure(dropped);
  if (dropFailure)
    return {
      state: 'indeterminate',
      reason:
        dropFailure.reason === 'PROCESS_GROUP_UNCONFIRMED'
          ? dropFailure.reason
          : 'OUTCOME_UNKNOWN',
      result: { stashOid: stashOid },
      refreshRequired: true,
    };
  const remaining = await readActionCommand(
    process,
    ['stash', 'list', '--format=%H%x00%gd%x00%gs'],
    signal,
  );
  const expectedOids = entries
    .filter((entry) => entry !== selected[0])
    .map((entry) => entry.split('\0')[0]);
  const actualOids = remaining.trimEnd()
    ? remaining
        .trimEnd()
        .split('\n')
        .map((entry) => entry.split('\0')[0])
    : [];
  if (JSON.stringify(expectedOids) !== JSON.stringify(actualOids))
    return {
      state: 'indeterminate',
      reason: 'OUTCOME_UNKNOWN',
      result: { stashOid: stashOid },
      refreshRequired: true,
    };
  return {
    state: 'succeeded',
    result: { stashOid: stashOid, stashRetained: false },
    refreshRequired: true,
  };
}
