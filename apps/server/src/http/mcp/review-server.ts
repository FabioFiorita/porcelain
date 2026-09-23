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
  resolveCommentThreadResponseSchema,
  resolveCommentToolRequestSchema,
} from '@porcelain/contracts/reviews';
import { z } from 'zod';
import type { CreateCommentThreadController } from '../../controllers/create-comment-thread-controller.ts';
import type { ListCommentThreadsController } from '../../controllers/list-comment-threads-controller.ts';
import type { PublishReviewController } from '../../controllers/publish-review-controller.ts';
import type { ReadPublishedReviewController } from '../../controllers/read-published-review-controller.ts';
import type { ReplyToCommentController } from '../../controllers/reply-to-comment-controller.ts';
import type { ResolveCommentThreadController } from '../../controllers/resolve-comment-thread-controller.ts';
import type { ResolveWorktreeByPathController } from '../../controllers/resolve-worktree-by-path-controller.ts';
import { toStatusResponse } from '../status-policy.ts';
import { REVIEW_GUIDE } from './review-guide.ts';

export type ReviewMcpControllers = {
  resolveWorktreeByPathController: Pick<
    ResolveWorktreeByPathController,
    'execute'
  >;
  publishReviewController: Pick<PublishReviewController, 'execute'>;
  readPublishedReviewController: Pick<ReadPublishedReviewController, 'execute'>;
  listCommentThreadsController: Pick<ListCommentThreadsController, 'execute'>;
  createCommentThreadController: Pick<CreateCommentThreadController, 'execute'>;
  replyToCommentController: Pick<ReplyToCommentController, 'execute'>;
  resolveCommentThreadController: Pick<
    ResolveCommentThreadController,
    'execute'
  >;
};

const agent = { kind: 'agent' } as const;

export function createReviewMcpServer(
  controllers: ReviewMcpControllers,
  defaultCwd: string,
) {
  const server = new McpServer(
    { name: 'porcelain', version: '1.0.0' },
    {
      instructions:
        'Publish and discuss the review for the registered worktree containing this MCP process cwd. Read porcelain://review-guide before publishing. Shell and editor tools remain the source for reading code.',
    },
  );
  const worktreeAt = async (cwd: string | undefined, signal: AbortSignal) =>
    (
      await controllers.resolveWorktreeByPathController.execute(
        { path: cwd ?? defaultCwd },
        { signal },
      )
    ).worktreeId;
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
      result(publishReviewToolResponseSchema, async () =>
        controllers.publishReviewController.execute(
          { worktreeId: await worktreeAt(cwd, signal), review },
          { signal },
        ),
      ),
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
        controllers.readPublishedReviewController.execute(
          { worktreeId: await worktreeAt(cwd, signal) },
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
        controllers.listCommentThreadsController.execute(
          { worktreeId: await worktreeAt(cwd, signal), scope },
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
        controllers.createCommentThreadController.execute(
          {
            worktreeId: await worktreeAt(cwd, signal),
            ...input,
            writer: agent,
          },
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
        controllers.replyToCommentController.execute(
          {
            worktreeId: await worktreeAt(cwd, signal),
            ...input,
            writer: agent,
          },
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
      result(resolveCommentThreadResponseSchema, async () =>
        controllers.resolveCommentThreadController.execute(
          { worktreeId: await worktreeAt(cwd, signal), ...input },
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
