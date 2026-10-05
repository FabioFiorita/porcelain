import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createCommentThreadResponseSchema,
  createCommentToolRequestSchema,
  listCommentsToolRequestSchema,
  listCommentThreadsResponseSchema,
  publishReviewToolRequestSchema,
  publishReviewToolResponseSchema,
  readPublishedReviewResponseSchema,
  readReviewToolRequestSchema,
  replyToCommentResponseSchema,
  replyToCommentToolRequestSchema,
  updateCommentThreadResponseSchema,
  resolveCommentToolRequestSchema,
} from '@porcelain/contracts/reviews';
import { Effect } from 'effect';
import { registerEffectTool } from './effect-tool.ts';
import type {
  AtWorktreePathUseCasePort,
  WorktreeOperationUseCasePort,
} from '../../ports/at-worktree-path-use-case-port.ts';
import type { CreateCommentThreadUseCase } from '../../use-cases/reviews/create-comment-thread.ts';
import type { ListCommentThreadsUseCase } from '../../use-cases/reviews/list-comment-threads.ts';
import type { PublishReviewUseCase } from '../../use-cases/reviews/publish-review.ts';
import type { ReadPublishedReviewUseCase } from '../../use-cases/reviews/read-published-review.ts';
import type { ReplyToCommentUseCase } from '../../use-cases/reviews/reply-to-comment.ts';
import type { UpdateCommentThreadUseCase } from '../../use-cases/reviews/update-comment-thread.ts';
import { REVIEW_GUIDE } from './review-guide.ts';

type AtPath<Operation extends WorktreeOperationUseCasePort> =
  AtWorktreePathUseCasePort<Operation>;

export type ReviewMcpUseCases = {
  reviewTools: {
    createCommentThreadAtPath: AtPath<CreateCommentThreadUseCase>;
    listCommentThreadsAtPath: AtPath<ListCommentThreadsUseCase>;
    publishReviewAtPath: AtPath<PublishReviewUseCase>;
    readPublishedReviewAtPath: AtPath<ReadPublishedReviewUseCase>;
    replyToCommentAtPath: AtPath<ReplyToCommentUseCase>;
    updateCommentThreadAtPath: AtPath<UpdateCommentThreadUseCase>;
  };
};

const agent = { kind: 'agent' } as const;

const summaryWarnings: Readonly<Record<string, string>> = {
  'missing-style':
    'No authored CSS was detected in the summary HTML. The review was published. Add CSS and republish, matching the reviewed application’s colors, background, typography and components where possible. Style the layer links and content hierarchy, then visually verify the result. If styles are generated at runtime, verify that they load correctly.',
};

export function createReviewMcpServer(
  useCases: ReviewMcpUseCases,
  defaultCwd: string,
) {
  const server = new McpServer(
    { name: 'porcelain', version: '1.0.0' },
    {
      instructions:
        'Publish and discuss the review for the registered worktree containing this MCP process cwd. Read porcelain://review-guide before publishing. Shell and editor tools remain the source for reading code.',
    },
  );
  server.registerResource(
    'review-guide',
    'porcelain://review-guide',
    {
      title: 'Porcelain review writing and design guide',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [
        { uri: uri.href, mimeType: 'text/markdown', text: REVIEW_GUIDE },
      ],
    }),
  );
  registerEffectTool(
    server,
    {
      name: 'publish_review',
      output: publishReviewToolResponseSchema,
      description:
        'Atomically replace the latest summary, diagram, review layers and proof. Read the current revision and porcelain://review-guide first. Include your own CSS, matching the reviewed application where possible; missing CSS produces an advisory warning. Attach proof that the work is done: checks you ran with their result, and screenshots, short videos or links.',
      input: publishReviewToolRequestSchema,
    },
    ({ cwd, ...review }) =>
      Effect.gen(function* () {
        const published =
          yield* useCases.reviewTools.publishReviewAtPath.execute({
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
  );
  registerEffectTool(
    server,
    {
      name: 'read_review',
      output: readPublishedReviewResponseSchema,
      description:
        'Read the latest published review, resolved pointers and uncovered changed lines.',
      input: readReviewToolRequestSchema,
      annotations: { readOnlyHint: true },
    },
    ({ cwd }) =>
      useCases.reviewTools.readPublishedReviewAtPath.execute({
        cwd: cwd ?? defaultCwd,
        request: {},
      }),
  );
  registerEffectTool(
    server,
    {
      name: 'list_comments',
      output: listCommentThreadsResponseSchema,
      description:
        'Read review threads waiting for the agent. Omit scope, or pass waiting, for unresolved threads whose latest message is not from the agent. Pass all to include every thread.',
      input: listCommentsToolRequestSchema,
      annotations: { readOnlyHint: true },
    },
    ({ cwd, scope }) =>
      useCases.reviewTools.listCommentThreadsAtPath.execute({
        cwd: cwd ?? defaultCwd,
        request: { scope },
      }),
  );
  registerEffectTool(
    server,
    {
      name: 'create_comment',
      output: createCommentThreadResponseSchema,
      description:
        'Create an agent review thread on the whole change (kind change, with a branch comparison and its tip for a branch review), a file or a code range. Stable optional IDs make retries idempotent.',
      input: createCommentToolRequestSchema,
    },
    ({ cwd, ...input }) =>
      useCases.reviewTools.createCommentThreadAtPath.execute({
        cwd: cwd ?? defaultCwd,
        request: { ...input, writer: agent },
      }),
  );
  registerEffectTool(
    server,
    {
      name: 'reply_to_comment',
      output: replyToCommentResponseSchema,
      description:
        'Reply to a review thread. Stable optional messageId makes retries idempotent.',
      input: replyToCommentToolRequestSchema,
    },
    ({ cwd, ...input }) =>
      useCases.reviewTools.replyToCommentAtPath.execute({
        cwd: cwd ?? defaultCwd,
        request: { ...input, writer: agent },
      }),
  );
  registerEffectTool(
    server,
    {
      name: 'resolve_comment',
      output: updateCommentThreadResponseSchema,
      description: 'Resolve or reopen a review thread.',
      input: resolveCommentToolRequestSchema,
    },
    ({ cwd, ...input }) =>
      useCases.reviewTools.updateCommentThreadAtPath.execute({
        cwd: cwd ?? defaultCwd,
        request: input,
      }),
  );
  return server;
}
