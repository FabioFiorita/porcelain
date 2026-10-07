import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { ActionRemote } from '../dtos/git-action-snapshot.ts';
import { GitActionRejectedError } from '../../shared/errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { readActionCommand } from './read-action-command.ts';
import { updateFetchTrackingRef } from './update-fetch-tracking-ref.ts';

export const fetchBranch = Effect.fn('Git.fetchBranch')(function* (
  process: GitProcessRunner,
  preparation: GitActionCommand<'fetch'> | GitActionCommand<'pull'>,
  remote: ActionRemote,
): Effect.fn.Return<GitActionOutcome, ActionFailure, ActionPlatform> {
  const intent = preparation.intent;
  const temporaryRef = `refs/porcelain/fetch/${preparation.id}`;
  const fetched = yield* process.execute([
    'fetch',
    '--progress',
    '--no-tags',
    '--no-prune',
    '--no-prune-tags',
    '--no-recurse-submodules',
    '--no-write-fetch-head',
    '--refmap=',
    remote.name,
    `${intent.sourceRef}:${temporaryRef}`,
  ]);
  const failure = processFailure(fetched);
  if (failure) return failure;
  const candidate = (yield* readActionCommand(process, [
    'rev-parse',
    '--verify',
    `${temporaryRef}^{commit}`,
  ])).trimEnd();
  const cleanup = process
    .execute(['update-ref', '-d', temporaryRef, candidate])
    .pipe(
      Effect.map(processFailure),
      Effect.timeout(process.limits.followUpTimeoutMs),
      Effect.catch((error) => Effect.succeed(uncertainFetch(error))),
    );
  return yield* Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* (): Effect.fn.Return<
      GitActionOutcome,
      ActionFailure,
      ActionPlatform
    > {
      const outcome = yield* restore(
        updateFetchTrackingRef(
          process,
          remote.trackingRef,
          candidate,
          preparation.preview.trackingOid,
        ),
      ).pipe(
        Effect.catch((error) => Effect.succeed(uncertainFetch(error))),
        Effect.onInterrupt(() => Effect.asVoid(cleanup)),
      );
      if (outcome.reason === 'PROCESS_GROUP_UNCONFIRMED') return outcome;
      const cleaned = yield* cleanup;
      if (cleaned)
        return { ...cleaned, state: 'indeterminate', refreshRequired: true };
      return outcome;
    }),
  );
});

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
