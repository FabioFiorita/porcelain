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
import { z } from 'zod';
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
import { toStatusResponse } from '../status-policy.ts';
import { REVIEW_GUIDE } from './review-guide.ts';

type AtPath<Operation extends WorktreeOperationUseCasePort> =
  AtWorktreePathUseCasePort<Operation>;

export type ReviewMcpUseCases = {
  reviews: {
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
  server.registerTool(
    'publish_review',
    {
      description:
        'Atomically replace the latest summary, diagram and review layers. Read the current revision and porcelain://review-guide first. Include your own CSS, matching the reviewed application where possible; missing CSS produces an advisory warning.',
      inputSchema: publishReviewToolRequestSchema,
    },
    ({ cwd, ...review }, { signal }) =>
      result(publishReviewToolResponseSchema, async () => {
        const published = await useCases.reviews.publishReviewAtPath.execute(
          { cwd: cwd ?? defaultCwd, request: review },
          { signal },
        );
        return {
          ...published,
          warnings: published.warnings.map(
            (warning) => summaryWarnings[warning] ?? warning,
          ),
        };
      }),
  );
  server.registerTool(
    'read_review',
    {
      description:
        'Read the latest published review, resolved pointers and uncovered changed lines.',
      inputSchema: readReviewToolRequestSchema,
      annotations: { readOnlyHint: true },
    },
    ({ cwd }, { signal }) =>
      result(readPublishedReviewResponseSchema, async () =>
        useCases.reviews.readPublishedReviewAtPath.execute(
          { cwd: cwd ?? defaultCwd, request: {} },
          { signal },
        ),
      ),
  );
  server.registerTool(
    'list_comments',
    {
      description:
        'Read review threads waiting for the agent. Omit scope, or pass waiting, for unresolved threads whose latest message is not from the agent. Pass all to include every thread.',
      inputSchema: listCommentsToolRequestSchema,
      annotations: { readOnlyHint: true },
    },
    ({ cwd, scope }, { signal }) =>
      result(listCommentThreadsResponseSchema, async () =>
        useCases.reviews.listCommentThreadsAtPath.execute(
          { cwd: cwd ?? defaultCwd, request: { scope } },
          { signal },
        ),
      ),
  );
  server.registerTool(
    'create_comment',
    {
      description:
        'Create an agent review thread on a file or code range. Stable optional IDs make retries idempotent.',
      inputSchema: createCommentToolRequestSchema,
    },
    ({ cwd, ...input }, { signal }) =>
      result(createCommentThreadResponseSchema, async () =>
        useCases.reviews.createCommentThreadAtPath.execute(
          { cwd: cwd ?? defaultCwd, request: { ...input, writer: agent } },
          { signal },
        ),
      ),
  );
  server.registerTool(
    'reply_to_comment',
    {
      description:
        'Reply to a review thread. Stable optional messageId makes retries idempotent.',
      inputSchema: replyToCommentToolRequestSchema,
    },
    ({ cwd, ...input }, { signal }) =>
      result(replyToCommentResponseSchema, async () =>
        useCases.reviews.replyToCommentAtPath.execute(
          { cwd: cwd ?? defaultCwd, request: { ...input, writer: agent } },
          { signal },
        ),
      ),
  );
  server.registerTool(
    'resolve_comment',
    {
      description: 'Resolve or reopen a review thread.',
      inputSchema: resolveCommentToolRequestSchema,
    },
    ({ cwd, ...input }, { signal }) =>
      result(updateCommentThreadResponseSchema, async () =>
        useCases.reviews.updateCommentThreadAtPath.execute(
          { cwd: cwd ?? defaultCwd, request: input },
          { signal },
        ),
      ),
  );
  return server;
}

async function result<Schema extends z.ZodType>(
  schema: Schema,
  operation: () => Promise<z.output<Schema>>,
) {
  try {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(z.encode(schema, await operation())),
        },
      ],
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(toStatusResponse(error).body ?? null),
        },
      ],
    };
  }
}
