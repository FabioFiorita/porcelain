import { nullOidFor } from '../../shared/parsers/oid.ts';
import type { GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { readActionAncestry } from './read-action-ancestry.ts';

export async function updateFetchTrackingRef(
  process: GitProcessRunner,
  trackingRef: string,
  candidate: string,
  expected: string | null | undefined,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  if (expected) {
    const ancestry = await readActionAncestry(
      process,
      expected,
      candidate,
      signal,
    );
    if (ancestry.kind === 'failed') return ancestry.outcome;
    if (ancestry.kind === 'not-ancestor')
      return {
        state: 'rejected',
        reason: 'NON_FAST_FORWARD',
        refreshRequired: true,
      };
  }
  const update = await process.execute(
    ['update-ref', trackingRef, candidate, expected ?? nullOidFor(candidate)],
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
