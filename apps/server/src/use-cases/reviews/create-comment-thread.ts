import { type InvalidLineRangeError } from '@porcelain/kernel/errors';
import {
  type CommentIdentityConflictError,
  type CommentLimitExceededError,
  type CommentRevisionMismatchError,
  type UnsupportedCommentComparisonError,
} from '@porcelain/reviews/errors';
import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import {
  type CommentAuthor,
  type CreateCommentThreadRequest,
  type CreateCommentThreadResponse,
} from '@porcelain/contracts/reviews';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import { CreateCommentThreadService } from '@porcelain/reviews/services';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class CreateCommentThreadUseCase extends Context.Service<
  CreateCommentThreadUseCase,
  {
    readonly execute: (
      input: WorktreeParams & CreateCommentThreadRequest & CommentAuthor,
    ) => Effect.Effect<
      CreateCommentThreadResponse,
      | WorktreeAccessFailure
      | CommentIdentityConflictError
      | CommentLimitExceededError
      | InvalidLineRangeError
      | CommentRevisionMismatchError
      | UnsupportedCommentComparisonError
    >;
  }
>()('@porcelain/server/CreateCommentThreadUseCase') {
  static readonly layer = Layer.effect(
    CreateCommentThreadUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const createCommentThreadCapability = yield* CreateCommentThreadService;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('CreateCommentThreadUseCase.execute')(function* (
          input: WorktreeParams & CreateCommentThreadRequest & CommentAuthor,
        ): Effect.fn.Return<
          CreateCommentThreadResponse,
          | WorktreeAccessFailure
          | CommentIdentityConflictError
          | CommentLimitExceededError
          | InvalidLineRangeError
          | CommentRevisionMismatchError
          | UnsupportedCommentComparisonError
        > {
          return yield* accessCapability.transaction(
            input.worktreeId,
            () => Effect.void,
            () => createCommentThreadCapability.execute(input),
            () =>
              Effect.sync(() => {
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
