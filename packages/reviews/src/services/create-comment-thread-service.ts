import { CreateCommentThreadOptions } from '../ports/create-comment-thread-options.ts';
import { Effect, Context, Layer } from 'effect';
import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import { Clock, IdSource } from '@porcelain/kernel/ports';
import { CommentIdentityConflictError } from '../errors/comment-identity-conflict-error.ts';
import { CommentLimitExceededError } from '../errors/comment-limit-exceeded-error.ts';
import { CommentRevisionMismatchError } from '../errors/comment-revision-mismatch-error.ts';
import { UnsupportedCommentComparisonError } from '../errors/unsupported-comment-comparison-error.ts';
import {
  type CommentAnchorProblem,
  type CommentContent,
} from '../models/comment-thread.ts';
import {
  type CreateCommentThreadInput,
  type CreateCommentThreadResult,
} from '../models/create-comment-thread.ts';
import { CommentStore } from '../ports/comment-store.ts';
import {
  commentAnchorProblem,
  commentAuthor,
  commentStorageSize,
  repeatsCreation,
  threadFits,
} from '../rules/comment-threads.ts';

export class CreateCommentThreadService extends Context.Service<
  CreateCommentThreadService,
  {
    readonly execute: (
      input: CreateCommentThreadInput,
    ) => Effect.Effect<
      CreateCommentThreadResult,
      | CommentIdentityConflictError
      | CommentLimitExceededError
      | InvalidLineRangeError
      | CommentRevisionMismatchError
      | UnsupportedCommentComparisonError
    >;
  }
>()('@porcelain/reviews/CreateCommentThreadService') {
  static readonly layer = Layer.effect(
    CreateCommentThreadService,
    Effect.gen(function* () {
      const commentsCapability = yield* CommentStore;
      const idSourceCapability = yield* IdSource;
      const clockCapability = yield* Clock;
      const optionsCapability = yield* CreateCommentThreadOptions;
      function operationFailure(
        problem: CommentAnchorProblem,
      ):
        | CommentIdentityConflictError
        | CommentLimitExceededError
        | InvalidLineRangeError
        | CommentRevisionMismatchError
        | UnsupportedCommentComparisonError {
        switch (problem.kind) {
          case 'reversed-range':
            return new InvalidLineRangeError();
          case 'revision-mismatch':
            return new CommentRevisionMismatchError();
          case 'unsupported-comparison':
            return new UnsupportedCommentComparisonError();
        }
      }
      return {
        execute: Effect.fn('CreateCommentThreadService.execute')(function* (
          input: CreateCommentThreadInput,
        ): Effect.fn.Return<
          CreateCommentThreadResult,
          | CommentIdentityConflictError
          | CommentLimitExceededError
          | InvalidLineRangeError
          | CommentRevisionMismatchError
          | UnsupportedCommentComparisonError
        > {
          const problem = commentAnchorProblem(input.anchor);
          if (problem) return yield* Effect.fail(operationFailure(problem));
          const threadId = input.threadId ?? idSourceCapability.next();
          const messageId = input.messageId ?? idSourceCapability.next();
          const author = commentAuthor(input.writer);
          const existing = commentsCapability.find({ threadId });
          if (existing) {
            if (
              !repeatsCreation(existing, {
                worktreeId: input.worktreeId,
                anchor: input.anchor,
                messageId,
                body: input.body,
                author,
              })
            )
              return yield* Effect.fail(new CommentIdentityConflictError());
            return existing;
          }
          if (commentsCapability.findMessage({ messageId }))
            return yield* Effect.fail(new CommentIdentityConflictError());
          const content: CommentContent = {
            id: threadId,
            worktreeId: input.worktreeId,
            anchor: structuredClone(input.anchor),
            messages: [
              {
                id: messageId,
                body: input.body,
                author,
                createdAt: clockCapability.now(),
              },
            ],
          };
          const sizeBytes = commentStorageSize(content);
          const usage = commentsCapability.usage({
            worktreeId: input.worktreeId,
          });
          if (!threadFits(usage, sizeBytes, optionsCapability))
            return yield* Effect.fail(new CommentLimitExceededError());
          return commentsCapability.insert({
            content,
            sizeBytes,
            writtenByAgent: author === 'agent',
          });
        }),
      };
    }),
  );
}
