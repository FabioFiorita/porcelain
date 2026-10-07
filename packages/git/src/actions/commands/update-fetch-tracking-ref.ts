import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import { nullOidFor } from '../../shared/parsers/oid.ts';
import type { GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { readActionAncestry } from './read-action-ancestry.ts';

export const updateFetchTrackingRef = Effect.fn('Git.updateFetchTrackingRef')(
  function* (
    process: GitProcessRunner,
    trackingRef: string,
    candidate: string,
    expected: string | null | undefined,
  ): Effect.fn.Return<GitActionOutcome, ActionFailure, ActionPlatform> {
    if (expected) {
      const ancestry = yield* readActionAncestry(process, expected, candidate);
      if (ancestry.kind === 'failed') return ancestry.outcome;
      if (ancestry.kind === 'not-ancestor')
        return {
          state: 'rejected',
          reason: 'NON_FAST_FORWARD',
          refreshRequired: true,
        };
    }
    const update = yield* process.execute([
      'update-ref',
      trackingRef,
      candidate,
      expected ?? nullOidFor(candidate),
    ]);
    const failure = processFailure(update);
    if (failure) return failure;
    return {
      state: expected === candidate ? 'no-change' : 'succeeded',
      result: { trackingOid: candidate },
      refreshRequired: true,
    };
  },
);
