import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import {
  type ListReviewedFilesQuery,
  type ListReviewedFilesResponse,
} from '@porcelain/contracts/reviews';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import { ListReviewedFilesService } from '@porcelain/reviews/services';

export class ListReviewedFilesUseCase extends Context.Service<
  ListReviewedFilesUseCase,
  {
    readonly execute: (
      input: WorktreeParams & ListReviewedFilesQuery,
    ) => Effect.Effect<ListReviewedFilesResponse, WorktreeAccessFailure>;
  }
>()('@porcelain/server/ListReviewedFilesUseCase') {
  static readonly layer = Layer.effect(
    ListReviewedFilesUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const listReviewedFilesCapability = yield* ListReviewedFilesService;

      return {
        execute: Effect.fn('ListReviewedFilesUseCase.execute')(function* (
          input: WorktreeParams & ListReviewedFilesQuery,
        ): Effect.fn.Return<ListReviewedFilesResponse, WorktreeAccessFailure> {
          const { worktreeId, scope } = input;
          const branch = scope === 'branch' ? input.branch : undefined;
          return yield* accessCapability.reviews(worktreeId, 'read', () =>
            Effect.gen(function* () {
              return yield* listReviewedFilesCapability.execute({
                worktreeId,
                scope,
                branch,
              });
            }),
          );
        }),
      };
    }),
  );
}
