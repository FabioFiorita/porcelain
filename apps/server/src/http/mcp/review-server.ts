import { resolve, sep } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createCommentThreadRequestSchema,
  replyToCommentRequestSchema,
  resolveCommentThreadRequestSchema,
} from '@porcelain/contracts/reviews';
import { publishReviewRequestSchema } from '@porcelain/contracts/reviews';
import { z } from 'zod';
import type { CreateCommentThreadController } from '../../controllers/create-comment-thread-controller.ts';
import type { ListCommentThreadsController } from '../../controllers/list-comment-threads-controller.ts';
import type { ReplyToCommentController } from '../../controllers/reply-to-comment-controller.ts';
import type { ResolveCommentThreadController } from '../../controllers/resolve-comment-thread-controller.ts';
import type { PublishReviewController } from '../../controllers/publish-review-controller.ts';
import type { ReadPublishedReviewController } from '../../controllers/read-published-review-controller.ts';
import type { ReadInventoryController } from '../../controllers/read-inventory-controller.ts';
import { toStatusResponse } from '../status-policy.ts';
import { REVIEW_GUIDE } from './review-guide.ts';

const scopeSchema = z.strictObject({
  cwd: z.string().min(1).max(4096).optional(),
});

export function commentsForAgent<
  T extends {
    resolved: boolean;
    messages: readonly { author: string }[];
  },
>(threads: readonly T[], scope: 'waiting' | 'all' = 'waiting'): T[] {
  if (scope === 'all') return [...threads];
  return threads.filter(
    (thread) => !thread.resolved && thread.messages.at(-1)?.author !== 'agent',
  );
}

export function createReviewMcpServer(
  controllers: {
    readInventoryController: Pick<ReadInventoryController, 'execute'>;
    publishReviewController: Pick<PublishReviewController, 'execute'>;
    readPublishedReviewController: Pick<
      ReadPublishedReviewController,
      'execute'
    >;
    listCommentThreadsController: Pick<ListCommentThreadsController, 'execute'>;
    createCommentThreadController: Pick<
      CreateCommentThreadController,
      'execute'
    >;
    replyToCommentController: Pick<ReplyToCommentController, 'execute'>;
    resolveCommentThreadController: Pick<
      ResolveCommentThreadController,
      'execute'
    >;
  },
  principal: { kind: 'agent' },
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
      inputSchema: scopeSchema.extend(publishReviewRequestSchema.shape),
    },
    async ({ cwd, ...input }, { signal }) =>
      result(async () => {
        const worktreeId = await worktreeFor(
          controllers,
          cwd ?? defaultCwd,
          signal,
        );
        const { review } = await controllers.publishReviewController.execute(
          { worktreeId, review: input },
          { signal },
        );
        const warning = summaryStyleWarning(input.summaryHtml);
        return warning ? { ...review, warnings: [warning] } : review;
      }),
  );
  server.registerTool(
    'read_review',
    {
      description:
        'Read the latest published review, resolved pointers and uncovered changed lines.',
      inputSchema: scopeSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ cwd }, { signal }) =>
      result(async () => {
        const worktreeId = await worktreeFor(
          controllers,
          cwd ?? defaultCwd,
          signal,
        );
        const { review } =
          await controllers.readPublishedReviewController.execute(
            { worktreeId },
            { signal },
          );
        return review ?? null;
      }),
  );
  server.registerTool(
    'list_comments',
    {
      description:
        'Read review threads waiting for the agent. Omit scope, or pass waiting, for unresolved threads whose latest message is not from the agent. Pass all to include every thread.',
      inputSchema: scopeSchema.extend({
        scope: z.enum(['waiting', 'all']).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ cwd, scope }, { signal }) =>
      result(async () => {
        const worktreeId = await worktreeFor(
          controllers,
          cwd ?? defaultCwd,
          signal,
        );
        const threads = await controllers.listCommentThreadsController.execute(
          { worktreeId },
          { signal },
        );
        return commentsForAgent(threads, scope ?? 'waiting');
      }),
  );
  server.registerTool(
    'create_comment',
    {
      description:
        'Create an agent review thread on a file or code range. Stable optional IDs make retries idempotent.',
      inputSchema: scopeSchema.extend(createCommentThreadRequestSchema.shape),
    },
    async ({ cwd, ...input }, { signal }) =>
      result(async () => {
        const worktreeId = await worktreeFor(
          controllers,
          cwd ?? defaultCwd,
          signal,
        );
        return controllers.createCommentThreadController.execute(
          { worktreeId, ...input, writer: principal },
          { signal },
        );
      }),
  );
  server.registerTool(
    'reply_to_comment',
    {
      description:
        'Reply to a review thread. Stable optional messageId makes retries idempotent.',
      inputSchema: scopeSchema.extend({
        threadId: z.uuid(),
        ...replyToCommentRequestSchema.shape,
      }),
    },
    async ({ cwd, ...input }, { signal }) =>
      result(async () => {
        const worktreeId = await worktreeFor(
          controllers,
          cwd ?? defaultCwd,
          signal,
        );
        return controllers.replyToCommentController.execute(
          { worktreeId, ...input, writer: principal },
          { signal },
        );
      }),
  );
  server.registerTool(
    'resolve_comment',
    {
      description: 'Resolve or reopen a review thread.',
      inputSchema: scopeSchema.extend({
        threadId: z.uuid(),
        ...resolveCommentThreadRequestSchema.shape,
      }),
    },
    async ({ cwd, ...input }, { signal }) =>
      result(async () => {
        const worktreeId = await worktreeFor(
          controllers,
          cwd ?? defaultCwd,
          signal,
        );
        return controllers.resolveCommentThreadController.execute(
          { worktreeId, ...input },
          { signal },
        );
      }),
  );
  return server;
}

async function worktreeFor(
  controllers: {
    readInventoryController: Pick<ReadInventoryController, 'execute'>;
  },
  cwd: string,
  signal?: AbortSignal,
) {
  const target = resolve(cwd);
  const inventory = await controllers.readInventoryController.execute(
    {},
    signal === undefined ? {} : { signal },
  );
  const selected = inventory.projects
    .flatMap((project) => project.worktrees)
    .filter(
      (worktree) =>
        target === worktree.path || target.startsWith(`${worktree.path}${sep}`),
    )
    .sort((left, right) => right.path.length - left.path.length)[0];
  if (!selected)
    throw new Error('No registered Porcelain worktree contains this cwd');
  return selected.id;
}

async function result(operation: () => unknown) {
  try {
    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(await operation()) },
      ],
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(toStatusResponse(error).body),
        },
      ],
    };
  }
}

export function summaryStyleWarning(html: string): string | undefined {
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const hasCss =
    /<style\b[^>]*>\s*[^<\s][\s\S]*?<\/style\s*>/i.test(markup) ||
    /<[^>]+\sstyle\s*=\s*(?:"[^"\s][^"]*"|'[^'\s][^']*'|[^\s"'=<>`]+)/i.test(
      markup,
    ) ||
    /<link\b(?=[^>]*\brel\s*=\s*(?:"[^"<>]*\bstylesheet\b[^"<>]*"|'[^'<>]*\bstylesheet\b[^'<>]*'|stylesheet(?=\s|\/?>)))[^>]*>/i.test(
      markup,
    );
  if (!hasCss)
    return 'No authored CSS was detected in the summary HTML. The review was published. Add CSS and republish, matching the reviewed application’s colors, background, typography and components where possible. Style the layer links and content hierarchy, then visually verify the result. If styles are generated at runtime, verify that they load correctly.';
}
