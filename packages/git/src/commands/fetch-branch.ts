import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { GitActionSnapshot } from '../dtos/git-action-snapshot.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from './action-outcome.ts';
import { readActionCommand } from './read-action-command.ts';
import { updateFetchTrackingRef } from './update-fetch-tracking-ref.ts';

export async function fetchBranch(
  process: GitProcessRunner,
  preparation: GitActionCommand,
  snapshot: GitActionSnapshot,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  const intent = preparation.intent;
  if (intent.action !== 'fetch' || !snapshot.remote)
    throw new Error('Invalid fetch intent');
  const temporaryRef = `refs/porcelain/fetch/${preparation.id}`;
  const fetched = await process.execute(
    [
      'fetch',
      '--no-tags',
      '--no-prune',
      '--no-prune-tags',
      '--no-recurse-submodules',
      '--no-write-fetch-head',
      '--refmap=',
      snapshot.remote.name,
      `${intent.sourceRef}:${temporaryRef}`,
    ],
    signal,
  );
  const failure = processFailure(fetched);
  if (failure)
    return {
      ...failure,
      state: 'indeterminate',
      reason: failure.reason ?? 'OUTCOME_UNKNOWN',
    };
  const candidate = (
    await readActionCommand(
      process,
      ['rev-parse', '--verify', `${temporaryRef}^{commit}`],
      signal,
    )
  ).trimEnd();
  const outcome = await updateFetchTrackingRef(
    process,
    snapshot.remote.trackingRef,
    candidate,
    preparation.preview.trackingOid,
    signal,
  ).catch(uncertainFetch);
  // Never run even cleanup commands after losing ownership of a process group.
  if (outcome.reason === 'PROCESS_GROUP_UNCONFIRMED') return outcome;
  const cleanup = await process
    .execute(
      ['update-ref', '-d', temporaryRef, candidate],
      AbortSignal.timeout(5000),
    )
    .then(processFailure)
    .catch(uncertainFetch);
  if (cleanup)
    return { ...cleanup, state: 'indeterminate', refreshRequired: true };
  return outcome;
}

function uncertainFetch(error: unknown): GitActionOutcome {
  return {
    state: 'indeterminate',
    reason:
      error instanceof GitActionRejectedError &&
      error.reason === 'PROCESS_GROUP_UNCONFIRMED'
        ? error.reason
        : 'OUTCOME_UNKNOWN',
    refreshRequired: true,
  };
}
