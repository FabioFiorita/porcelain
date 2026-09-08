import type { GitActionOutcome } from '../../models/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from './action-outcome.ts';

export async function updateFetchTrackingRef(
  process: GitProcessRunner,
  trackingRef: string,
  candidate: string,
  expected: string | null | undefined,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  if (expected) {
    const ancestry = await process.execute(
      ['merge-base', '--is-ancestor', expected, candidate],
      signal,
    );
    const failure = processFailure(ancestry);
    if (failure?.state === 'indeterminate') return failure;
    if (ancestry.exitCode === 1)
      return {
        state: 'rejected',
        reason: 'NON_FAST_FORWARD',
        refreshRequired: true,
      };
    if (failure) return failure;
  }
  const update = await process.execute(
    [
      'update-ref',
      trackingRef,
      candidate,
      expected ?? '0'.repeat(candidate.length),
    ],
    signal,
  );
  const failure = processFailure(update);
  if (failure) return failure;
  return {
    state: expected === candidate ? 'no-change' : 'succeeded',
    result: { trackingOid: candidate },
    refreshRequired: true,
  };
}
