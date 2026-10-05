import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { type ListReviewedLayersResponse } from '@porcelain/contracts/reviews';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import { ReadTextFilesService } from '@porcelain/files/services';
import {
  ListReviewedLayerPathsService,
  ListReviewedLayersService,
} from '@porcelain/reviews/services';

export class ListReviewedLayersUseCase extends Context.Service<
  ListReviewedLayersUseCase,
  {
    readonly execute: (
      input: WorktreeParams,
    ) => Effect.Effect<ListReviewedLayersResponse, WorktreeAccessFailure>;
  }
>()('@porcelain/server/ListReviewedLayersUseCase') {
  static readonly layer = Layer.effect(
    ListReviewedLayersUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const listReviewedLayerPathsCapability =
        yield* ListReviewedLayerPathsService;
      const readTextFilesCapability = yield* ReadTextFilesService;
      const listReviewedLayersCapability = yield* ListReviewedLayersService;

      return {
        execute: Effect.fn('ListReviewedLayersUseCase.execute')(function* (
          input: WorktreeParams,
        ): Effect.fn.Return<ListReviewedLayersResponse, WorktreeAccessFailure> {
          const { worktreeId } = input;
          return yield* accessCapability.reviews(worktreeId, 'read', () =>
            Effect.gen(function* () {
              const { paths: marked } =
                yield* listReviewedLayerPathsCapability.execute({
                  worktreeId,
                });
              const listed = yield* readTextFilesCapability.execute({
                worktreeId,
                paths: marked,
              });
              return yield* listReviewedLayersCapability.execute({
                worktreeId,
                texts: listed.texts,
              });
            }),
          );
        }),
      };
    }),
  );
}
