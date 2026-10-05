import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import {
  type CommentAuthor,
  type DeleteResolvedCommentsRequest,
  type DeleteResolvedCommentsResponse,
} from '@porcelain/contracts/reviews';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import { DeleteResolvedCommentsService } from '@porcelain/reviews/services';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class DeleteResolvedCommentsUseCase extends Context.Service<
  DeleteResolvedCommentsUseCase,
  {
    readonly execute: (
      input: WorktreeParams & DeleteResolvedCommentsRequest & CommentAuthor,
    ) => Effect.Effect<DeleteResolvedCommentsResponse, WorktreeAccessFailure>;
  }
>()('@porcelain/server/DeleteResolvedCommentsUseCase') {
  static readonly layer = Layer.effect(
    DeleteResolvedCommentsUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const deleteResolvedCommentsCapability =
        yield* DeleteResolvedCommentsService;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('DeleteResolvedCommentsUseCase.execute')(function* (
          input: WorktreeParams & DeleteResolvedCommentsRequest & CommentAuthor,
        ): Effect.fn.Return<
          DeleteResolvedCommentsResponse,
          WorktreeAccessFailure
        > {
          return yield* accessCapability.transaction(
            input.worktreeId,
            () => Effect.void,
            () => deleteResolvedCommentsCapability.execute(input),
            (value) =>
              Effect.sync(() => {
                if (value.deleted.length > 0)
                  eventsCapability.worktreeChanged({
                    worktreeId: input.worktreeId,
                    change: 'comments',
                  });
              }),
          );
        }),
      };
    }),
  );
}
