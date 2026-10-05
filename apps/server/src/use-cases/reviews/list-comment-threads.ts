import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import {
  type ListCommentThreadsQuery,
  type ListCommentThreadsResponse,
} from '@porcelain/contracts/reviews';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import { ListCommentThreadsService } from '@porcelain/reviews/services';

export class ListCommentThreadsUseCase extends Context.Service<
  ListCommentThreadsUseCase,
  {
    readonly execute: (
      input: WorktreeParams & ListCommentThreadsQuery,
    ) => Effect.Effect<ListCommentThreadsResponse, WorktreeAccessFailure>;
  }
>()('@porcelain/server/ListCommentThreadsUseCase') {
  static readonly layer = Layer.effect(
    ListCommentThreadsUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const listCommentThreadsCapability = yield* ListCommentThreadsService;

      return {
        execute: Effect.fn('ListCommentThreadsUseCase.execute')(function* (
          input: WorktreeParams & ListCommentThreadsQuery,
        ): Effect.fn.Return<ListCommentThreadsResponse, WorktreeAccessFailure> {
          const { worktreeId } = input;
          return yield* accessCapability.reviews(worktreeId, 'read', () =>
            Effect.gen(function* () {
              return yield* listCommentThreadsCapability.execute(input);
            }),
          );
        }),
      };
    }),
  );
}
