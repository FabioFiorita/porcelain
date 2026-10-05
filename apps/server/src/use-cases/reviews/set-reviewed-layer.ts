import {
  type ReviewLayerNotFoundError,
  type ReviewedMarkConflictError,
} from '@porcelain/reviews/errors';
import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { ReadTextFilesService } from '@porcelain/files/services';
import {
  type SetReviewedLayerRequest,
  type SetReviewedLayerResponse,
} from '@porcelain/contracts/reviews';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import {
  ListReviewedLayerPathsService,
  ListReviewedLayersService,
  ReadReviewLayerService,
  SetReviewedLayerService,
} from '@porcelain/reviews/services';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class SetReviewedLayerUseCase extends Context.Service<
  SetReviewedLayerUseCase,
  {
    readonly execute: (
      input: WorktreeParams & SetReviewedLayerRequest,
    ) => Effect.Effect<
      SetReviewedLayerResponse,
      | WorktreeAccessFailure
      | ReviewLayerNotFoundError
      | ReviewedMarkConflictError
    >;
  }
>()('@porcelain/server/SetReviewedLayerUseCase') {
  static readonly layer = Layer.effect(
    SetReviewedLayerUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readReviewLayerCapability = yield* ReadReviewLayerService;
      const readTextFilesCapability = yield* ReadTextFilesService;
      const setReviewedLayerCapability = yield* SetReviewedLayerService;
      const listReviewedLayerPathsCapability =
        yield* ListReviewedLayerPathsService;
      const listReviewedLayersCapability = yield* ListReviewedLayersService;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('SetReviewedLayerUseCase.execute')(function* (
          input: WorktreeParams & SetReviewedLayerRequest,
        ): Effect.fn.Return<
          SetReviewedLayerResponse,
          | WorktreeAccessFailure
          | ReviewLayerNotFoundError
          | ReviewedMarkConflictError
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId } = input;
            return accessCapability.transaction(
              worktreeId,
              () =>
                Effect.gen(function* () {
                  const { layer, paths } =
                    yield* readReviewLayerCapability.execute({
                      worktreeId,
                      layerId: input.layerId,
                    });
                  const marked =
                    yield* listReviewedLayerPathsCapability.execute({
                      worktreeId,
                    });
                  const { texts } = yield* readTextFilesCapability.execute({
                    worktreeId,
                    paths: [...new Set([...paths, ...marked.paths])],
                  });
                  return { layer, texts };
                }),
              ({ layer, texts }) =>
                Effect.gen(function* () {
                  yield* setReviewedLayerCapability.execute({
                    worktreeId,
                    layer,
                    fingerprint: input.fingerprint,
                    texts,
                  });
                  return yield* listReviewedLayersCapability.execute({
                    worktreeId,
                    texts,
                  });
                }),
              () =>
                eventsCapability.worktreeChanged({
                  worktreeId,
                  change: 'reviewed',
                }),
            );
          });
        }),
      };
    }),
  );
}
