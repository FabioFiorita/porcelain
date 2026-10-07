import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { ActionRemote } from '../dtos/git-action-snapshot.ts';
import { rejectBusyCheckout } from './reject-busy-checkout.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { fetchBranch } from './fetch-branch.ts';
import { readActionBranch } from './read-action-branch.ts';
import { readActionAncestry } from './read-action-ancestry.ts';
import { readActionHead } from './read-action-head.ts';
import { readActionStatus } from './read-action-status.ts';

export const pullBranch = Effect.fn('Git.pullBranch')(function* (
  process: GitProcessRunner,
  preparation: GitActionCommand<'pull'>,
  remote: ActionRemote,
): Effect.fn.Return<GitActionOutcome, ActionFailure, ActionPlatform> {
  const fetched = yield* fetchBranch(process, preparation, remote);
  if (fetched.state !== 'succeeded' && fetched.state !== 'no-change')
    return fetched;
  const candidate = fetched.result?.trackingOid;
  if (!candidate)
    return {
      state: 'indeterminate',
      reason: 'OUTCOME_UNKNOWN',
      refreshRequired: true,
    };
  const head = yield* readActionHead(process);
  const branch = yield* readActionBranch(process);
  const changes = yield* readActionStatus(process);
  if (
    head !== preparation.preview.headOid ||
    branch !== preparation.preview.branch ||
    changes.length > 0
  )
    return {
      state: 'rejected',
      reason: 'STALE_PREPARATION',
      refreshRequired: true,
    };
  if (head === candidate)
    return {
      state: 'no-change',
      result: { headOid: head },
      refreshRequired: true,
    };
  const strategy = preparation.intent.strategy ?? 'ff-only';
  const ancestry = yield* readActionAncestry(process, head, candidate);
  if (ancestry.kind === 'failed') return ancestry.outcome;
  if (ancestry.kind === 'not-ancestor') {
    const ahead = yield* readActionAncestry(process, candidate, head);
    if (ahead.kind === 'failed') return ahead.outcome;
    if (ahead.kind === 'ancestor')
      return {
        state: 'no-change',
        result: { headOid: head, trackingOid: candidate },
        refreshRequired: true,
      };
    if (strategy === 'ff-only')
      return {
        state: 'rejected',
        reason: 'NON_FAST_FORWARD',
        refreshRequired: true,
      };
  }
  const integrated = yield* process.execute(
    strategy === 'rebase'
      ? [
          'rebase',
          '--no-autostash',
          '--no-autosquash',
          '--no-update-refs',
          '--no-rebase-merges',
          '--no-fork-point',
          candidate,
        ]
      : [
          'merge',
          strategy === 'ff-only' ? '--ff-only' : '--ff',
          '--no-squash',
          '--commit',
          '--no-autostash',
          '--no-edit',
          '--no-stat',
          candidate,
        ],
  );
  const failure = processFailure(integrated);
  if (failure) {
    if (failure.state === 'indeterminate') return failure;
    const busy = yield* rejectBusyCheckout(process).pipe(
      Effect.map(() => false),
      Effect.catchTag('GitActionRejectedError', (error) =>
        error.reason === 'CHECKOUT_BUSY'
          ? Effect.succeed(true)
          : Effect.fail(error),
      ),
    );
    if (busy)
      return {
        state: 'conflicted',
        result: { trackingOid: candidate },
        refreshRequired: true,
      };
    return failure;
  }
  const result = yield* readActionHead(process);
  const contains = yield* readActionAncestry(process, candidate, result);
  if (contains.kind === 'failed' && contains.outcome.state === 'indeterminate')
    return contains.outcome;
  return contains.kind === 'ancestor'
    ? {
        state: 'succeeded',
        result: { headOid: result, trackingOid: candidate },
        refreshRequired: true,
      }
    : {
        state: 'indeterminate',
        reason: 'OUTCOME_UNKNOWN',
        refreshRequired: true,
      };
});
