import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import {
  type RemoveReviewedFileQuery,
  type RemoveReviewedFilesRequest,
  type RemoveReviewedFilesResponse,
} from '@porcelain/contracts/reviews';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import { RemoveReviewedFilesService } from '@porcelain/reviews/services';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class RemoveReviewedFilesUseCase extends Context.Service<
  RemoveReviewedFilesUseCase,
  {
    readonly execute: (
      input: WorktreeParams &
        (RemoveReviewedFileQuery | RemoveReviewedFilesRequest),
    ) => Effect.Effect<RemoveReviewedFilesResponse, WorktreeAccessFailure>;
  }
>()('@porcelain/server/RemoveReviewedFilesUseCase') {
  static readonly layer = Layer.effect(
    RemoveReviewedFilesUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const removeReviewedFilesCapability = yield* RemoveReviewedFilesService;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('RemoveReviewedFilesUseCase.execute')(function* (
          input: WorktreeParams &
            (RemoveReviewedFileQuery | RemoveReviewedFilesRequest),
        ): Effect.fn.Return<
          RemoveReviewedFilesResponse,
          WorktreeAccessFailure
        > {
          return yield* accessCapability
            .transaction(
              input.worktreeId,
              () => Effect.void,
              () =>
                removeReviewedFilesCapability.execute({
                  worktreeId: input.worktreeId,
                  scope: input.scope,
                  branch: input.scope === 'branch' ? input.branch : undefined,
                  paths: 'paths' in input ? input.paths : [input.path],
                }),
              (value) =>
                Effect.sync(() => {
                  if (value.removed)
                    eventsCapability.worktreeChanged({
                      worktreeId: input.worktreeId,
                      change: 'reviewed',
                    });
                }),
            )
            .pipe(
              Effect.map((value) =>
                (({ removed, ...response }) => response)(value),
              ),
            );
        }),
      };
    }),
  );
}
