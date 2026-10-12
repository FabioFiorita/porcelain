import { type Context, Effect, Layer } from 'effect';
import { McpServer } from 'effect/ai';
import { HttpServerRequest } from 'effect/http';
import { ReviewToolkit } from '@porcelain/contracts/reviews';
import { toStatusResponse } from '../status-policy.ts';
import { RequestError } from '../../runtime/errors/request-error.ts';
import { type AtWorktreePathUseCase } from '../../use-cases/reviews/at-worktree-path.ts';
import { type CreateCommentThreadUseCase } from '../../use-cases/reviews/create-comment-thread.ts';
import { type ListCommentThreadsUseCase } from '../../use-cases/reviews/list-comment-threads.ts';
import { type DeleteReviewUseCase } from '../../use-cases/reviews/delete-review.ts';
import { type PublishReviewUseCase } from '../../use-cases/reviews/publish-review.ts';
import { type ReadPublishedReviewUseCase } from '../../use-cases/reviews/read-published-review.ts';
import { type ReplyToCommentUseCase } from '../../use-cases/reviews/reply-to-comment.ts';
import { type UpdateCommentThreadUseCase } from '../../use-cases/reviews/update-comment-thread.ts';
import { httpEvent, toolAudit } from '../diagnostics.ts';
import { REVIEW_GUIDE } from './review-guide.ts';
export type ReviewMcpUseCases = {
  reviewTools: {
    atWorktreePath: Context.Service.Shape<typeof AtWorktreePathUseCase>;
    createCommentThread: Context.Service.Shape<
      typeof CreateCommentThreadUseCase
    >;
    listCommentThreads: Context.Service.Shape<typeof ListCommentThreadsUseCase>;
    deleteReview: Context.Service.Shape<typeof DeleteReviewUseCase>;
    publishReview: Context.Service.Shape<typeof PublishReviewUseCase>;
    readPublishedReview: Context.Service.Shape<
      typeof ReadPublishedReviewUseCase
    >;
    replyToComment: Context.Service.Shape<typeof ReplyToCommentUseCase>;
    updateCommentThread: Context.Service.Shape<
      typeof UpdateCommentThreadUseCase
    >;
  };
};

const agent = { kind: 'agent' } as const;

const summaryWarnings: Readonly<Record<string, string>> = {
  'missing-style':
    'No authored CSS was detected in the summary HTML. The review was published. Add CSS and republish, matching the reviewed application’s colors, background, typography and components where possible. Style the layer links and content hierarchy, then visually verify the result. If styles are generated at runtime, verify that they load correctly.',
};

function invocation<A, E>(
  tool: keyof typeof ReviewToolkit.tools,
  operation: (cwd: string) => Effect.Effect<A, E>,
) {
  return Effect.gen(function* () {
    const request = yield* Effect.serviceOption(
      HttpServerRequest.HttpServerRequest,
    );
    const cwd =
      request._tag === 'Some'
        ? request.value.headers['x-porcelain-cwd']
        : undefined;
    if (cwd === undefined || cwd === '')
      return yield* Effect.fail(
        new RequestError({
          statusCode: 400,
          message: 'The x-porcelain-cwd header is required',
        }),
      );
    yield* toolAudit(tool);
    return yield* operation(cwd);
  }).pipe(
    Effect.mapError(
      (error) =>
        toStatusResponse(error).body ?? {
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Operation failed',
        },
    ),
  );
}

export function reviewMcpHandlers(useCases: ReviewMcpUseCases) {
  return Layer.mergeAll(
    McpServer.toolkit(ReviewToolkit).pipe(
      Layer.tap(() =>
        Effect.sync(() => {
          for (const tool of Object.keys(ReviewToolkit.tools))
            httpEvent({ event: 'tool-registered', owner: true, tool });
        }),
      ),
      Layer.provide(
        ReviewToolkit.toLayer({
          publish_review: ({ cwd, ...review }) =>
            invocation('publish_review', (defaultCwd) =>
              Effect.gen(function* () {
                const published =
                  yield* useCases.reviewTools.atWorktreePath.execute({
                    operation: useCases.reviewTools.publishReview,
                    cwd: cwd ?? defaultCwd,
                    request: review,
                  });
                return {
                  ...published,
                  warnings: published.warnings.map(
                    (warning) => summaryWarnings[warning] ?? warning,
                  ),
                };
              }),
            ),
          delete_review: ({ cwd }) =>
            invocation('delete_review', (defaultCwd) =>
              useCases.reviewTools.atWorktreePath.execute({
                operation: useCases.reviewTools.deleteReview,
                cwd: cwd ?? defaultCwd,
                request: {},
              }),
            ),
          read_review: ({ cwd }) =>
            invocation('read_review', (defaultCwd) =>
              useCases.reviewTools.atWorktreePath.execute({
                operation: useCases.reviewTools.readPublishedReview,
                cwd: cwd ?? defaultCwd,
                request: {},
              }),
            ),
          list_comments: ({ cwd, scope }) =>
            invocation('list_comments', (defaultCwd) =>
              Effect.map(
                useCases.reviewTools.atWorktreePath.execute({
                  operation: useCases.reviewTools.listCommentThreads,
                  cwd: cwd ?? defaultCwd,
                  request: { scope },
                }),
                (threads) => ({ threads }),
              ),
            ),
          create_comment: ({ cwd, ...input }) =>
            invocation('create_comment', (defaultCwd) =>
              useCases.reviewTools.atWorktreePath.execute({
                operation: useCases.reviewTools.createCommentThread,
                cwd: cwd ?? defaultCwd,
                request: { ...input, writer: agent },
              }),
            ),
          reply_to_comment: ({ cwd, ...input }) =>
            invocation('reply_to_comment', (defaultCwd) =>
              useCases.reviewTools.atWorktreePath.execute({
                operation: useCases.reviewTools.replyToComment,
                cwd: cwd ?? defaultCwd,
                request: { ...input, writer: agent },
              }),
            ),
          resolve_comment: ({ cwd, ...input }) =>
            invocation('resolve_comment', (defaultCwd) =>
              useCases.reviewTools.atWorktreePath.execute({
                operation: useCases.reviewTools.updateCommentThread,
                cwd: cwd ?? defaultCwd,
                request: input,
              }),
            ),
        }),
      ),
    ),
    McpServer.resource({
      uri: 'porcelain://review-guide',
      name: 'review-guide',
      description: 'Porcelain review writing and design guide',
      mimeType: 'text/markdown',
      content: Effect.succeed(REVIEW_GUIDE),
    }),
  );
}
