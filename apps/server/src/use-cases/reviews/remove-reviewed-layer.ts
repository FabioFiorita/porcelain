import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import {
  type RemoveReviewedLayerQuery,
  type RemoveReviewedLayerResponse,
} from '@porcelain/contracts/reviews';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import { ReadTextFilesService } from '@porcelain/files/services';
import {
  ListReviewedLayerPathsService,
  ListReviewedLayersService,
  RemoveReviewedLayerService,
} from '@porcelain/reviews/services';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class RemoveReviewedLayerUseCase extends Context.Service<
  RemoveReviewedLayerUseCase,
  {
    readonly execute: (
      input: WorktreeParams & RemoveReviewedLayerQuery,
    ) => Effect.Effect<RemoveReviewedLayerResponse, WorktreeAccessFailure>;
  }
>()('@porcelain/server/RemoveReviewedLayerUseCase') {
  static readonly layer = Layer.effect(
    RemoveReviewedLayerUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const removeReviewedLayerCapability = yield* RemoveReviewedLayerService;
      const listReviewedLayerPathsCapability =
        yield* ListReviewedLayerPathsService;
      const readTextFilesCapability = yield* ReadTextFilesService;
      const listReviewedLayersCapability = yield* ListReviewedLayersService;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('RemoveReviewedLayerUseCase.execute')(function* (
          input: WorktreeParams & RemoveReviewedLayerQuery,
        ): Effect.fn.Return<
          RemoveReviewedLayerResponse,
          WorktreeAccessFailure
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId } = input;
            return accessCapability
              .transaction(
                worktreeId,
                () =>
                  Effect.gen(function* () {
                    const { paths } =
                      yield* listReviewedLayerPathsCapability.execute({
                        worktreeId,
                      });
                    return yield* readTextFilesCapability.execute({
                      worktreeId,
                      paths,
                    });
                  }),
                ({ texts }) =>
                  Effect.gen(function* () {
                    const { removed } =
                      yield* removeReviewedLayerCapability.execute(input);
                    return {
                      removed,
                      ...(yield* listReviewedLayersCapability.execute({
                        worktreeId,
                        texts,
                      })),
                    };
                  }),
                ({ removed }) =>
                  Effect.gen(function* () {
                    if (removed)
                      yield* eventsCapability.worktreeChanged({
                        worktreeId,
                        change: 'reviewed',
                      });
                  }),
              )
              .pipe(Effect.map(({ removed, ...response }) => response));
          });
        }),
      };
    }),
  );
}
