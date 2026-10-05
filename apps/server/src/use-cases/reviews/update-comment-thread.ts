import { type CommentTargetNotFoundError } from '@porcelain/reviews/errors';
import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import {
  type CommentThreadParams,
  type UpdateCommentThreadRequest,
  type UpdateCommentThreadResponse,
} from '@porcelain/contracts/reviews';
import { UpdateCommentThreadService } from '@porcelain/reviews/services';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class UpdateCommentThreadUseCase extends Context.Service<
  UpdateCommentThreadUseCase,
  {
    readonly execute: (
      input: CommentThreadParams & UpdateCommentThreadRequest,
    ) => Effect.Effect<
      UpdateCommentThreadResponse,
      WorktreeAccessFailure | CommentTargetNotFoundError
    >;
  }
>()('@porcelain/server/UpdateCommentThreadUseCase') {
  static readonly layer = Layer.effect(
    UpdateCommentThreadUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const updateCommentThreadCapability = yield* UpdateCommentThreadService;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('UpdateCommentThreadUseCase.execute')(function* (
          input: CommentThreadParams & UpdateCommentThreadRequest,
        ): Effect.fn.Return<
          UpdateCommentThreadResponse,
          WorktreeAccessFailure | CommentTargetNotFoundError
        > {
          return yield* accessCapability
            .transaction(
              input.worktreeId,
              () => Effect.void,
              () => updateCommentThreadCapability.execute(input),
              (value) =>
                Effect.gen(function* () {
                  if (value.changed)
                    yield* eventsCapability.worktreeChanged({
                      worktreeId: input.worktreeId,
                      change: 'comments',
                    });
                }),
            )
            .pipe(Effect.map((value) => value.thread));
        }),
      };
    }),
  );
}
