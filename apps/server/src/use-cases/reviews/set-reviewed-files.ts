import { type GitIoFailure } from '@porcelain/git/errors';
import {
  type BranchBaseNotFoundError,
  type UnbornBranchError,
  type UnrelatedBranchError,
} from '@porcelain/changes/errors';
import { type ReviewedMarkConflictError } from '@porcelain/reviews/errors';
import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import {
  ReadBranchChangesService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import {
  type ReviewedFileConflictPolicy,
  type SetReviewedFileRequest,
  type SetReviewedFilesRequest,
  type SetReviewedFilesResponse,
} from '@porcelain/contracts/reviews';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import { SetReviewedFilesService } from '@porcelain/reviews/services';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class SetReviewedFilesUseCase extends Context.Service<
  SetReviewedFilesUseCase,
  {
    readonly execute: (
      input: WorktreeParams &
        (SetReviewedFilesRequest | SetReviewedFileRequest) &
        ReviewedFileConflictPolicy,
    ) => Effect.Effect<
      SetReviewedFilesResponse,
      | WorktreeAccessFailure
      | ReviewedMarkConflictError
      | GitIoFailure
      | BranchBaseNotFoundError
      | UnbornBranchError
      | UnrelatedBranchError
    >;
  }
>()('@porcelain/server/SetReviewedFilesUseCase') {
  static readonly layer = Layer.effect(
    SetReviewedFilesUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readWorktreeStatusCapability = yield* ReadWorktreeStatusService;
      const readChangeFingerprintsCapability =
        yield* ReadChangeFingerprintsService;
      const readBranchChangesCapability = yield* ReadBranchChangesService;
      const setReviewedFilesCapability = yield* SetReviewedFilesService;
      const eventsCapability = yield* EventPublisher;
      function operationWorktreeChanges(worktreeId: string) {
        return Effect.gen(function* () {
          const status = yield* readWorktreeStatusCapability.execute({
            worktreeId,
          });
          const { changes } = yield* readChangeFingerprintsCapability.execute({
            worktreeId,
            comparisons: status.changes,
            paths: undefined,
          });
          return changes;
        });
      }
      return {
        execute: Effect.fn('SetReviewedFilesUseCase.execute')(function* (
          input: WorktreeParams &
            (SetReviewedFilesRequest | SetReviewedFileRequest) &
            ReviewedFileConflictPolicy,
        ): Effect.fn.Return<
          SetReviewedFilesResponse,
          | WorktreeAccessFailure
          | ReviewedMarkConflictError
          | GitIoFailure
          | BranchBaseNotFoundError
          | UnbornBranchError
          | UnrelatedBranchError
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId } = input;
            return accessCapability
              .transaction(
                worktreeId,
                () =>
                  Effect.gen(function* () {
                    const branch =
                      input.scope === 'branch'
                        ? yield* readBranchChangesCapability.execute({
                            worktreeId,
                            base: input.base,
                          })
                        : undefined;
                    const changes =
                      branch?.files ??
                      (yield* operationWorktreeChanges(worktreeId));
                    return { branch, changes };
                  }),
                ({ branch, changes }) =>
                  setReviewedFilesCapability.execute({
                    worktreeId,
                    scope: input.scope,
                    branch: branch?.head.branch,
                    files:
                      'files' in input
                        ? input.files
                        : [
                            {
                              path: input.path,
                              fingerprint: input.fingerprint,
                            },
                          ],
                    changes,
                    onConflict: input.onConflict,
                  }),
                ({ changed }) =>
                  Effect.sync(() => {
                    if (changed)
                      eventsCapability.worktreeChanged({
                        worktreeId,
                        change: 'reviewed',
                      });
                  }),
              )
              .pipe(Effect.map(({ changed, ...result }) => result));
          });
        }),
      };
    }),
  );
}
