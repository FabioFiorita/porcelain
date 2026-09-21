import { resolve, sep } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createCommentThreadSchema,
  replyToCommentSchema,
  resolveCommentSchema,
} from '@porcelain/contracts/comments';
import { publishReviewSchema } from '@porcelain/contracts/review';
import { z } from 'zod';
import type { Application } from '../../application.ts';
import type { AuthenticatedPrincipal } from '../../models/principal.ts';
import { toErrorResponse } from '../mappers/error-response.ts';

const scopeSchema = z.strictObject({
  cwd: z.string().min(1).max(4096).optional(),
});

const GUIDE = `# Publishing a Porcelain review

Tell the behavior from entry point to outcome. Keep layers short and ordered; use lanes for the parts crossed (for example Web, Route, Use case, Storage). A changed step points at code this change alters. A context step points at unchanged code needed to understand the path. Prefer one or two sentences per step and finish the summary with the verification that actually ran.

The summary is one complete HTML document up to 10 MiB. It runs in an opaque sandbox with scripts, forms, popups and modals. Network resources such as high-quality CDN fonts and libraries are allowed, but the page cannot access Porcelain login state or APIs. Use CSS variables --porcelain-background and --porcelain-foreground. Link to layers with #layer-N, where N is the 1-based published order; Porcelain handles navigation. Do not embed credentials.

Publish replaces the entire latest review under expectedRevision. Read first, preserve anything still intended, then publish. Unresolved pointers are returned as changed. Not explained is computed by Porcelain from changed lines outside changed steps.`;

export function createReviewMcpServer(
  application: Application,
  principal: AuthenticatedPrincipal,
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
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: GUIDE }],
    }),
  );
  server.registerTool(
    'publish_review',
    {
      description:
        'Atomically replace the latest summary, diagram and review layers. Read the current revision first.',
      inputSchema: scopeSchema.extend(publishReviewSchema.shape),
    },
    async ({ cwd, ...input }, { signal }) =>
      result(async () => {
        const worktreeId = await worktreeFor(
          application,
          cwd ?? defaultCwd,
          signal,
        );
        return application.publishReview(worktreeId, input, signal);
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
          application,
          cwd ?? defaultCwd,
          signal,
        );
        return application.review(worktreeId, signal);
      }),
  );
  server.registerTool(
    'list_comments',
    {
      description: 'Read review threads, replies and resolved state.',
      inputSchema: scopeSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ cwd }, { signal }) =>
      result(async () => {
        const worktreeId = await worktreeFor(
          application,
          cwd ?? defaultCwd,
          signal,
        );
        return application.comments(
          { kind: 'list', worktreeId },
          principal,
          signal,
        );
      }),
  );
  server.registerTool(
    'create_comment',
    {
      description:
        'Create an agent review thread on a file or code range. Stable optional IDs make retries idempotent.',
      inputSchema: scopeSchema.extend(createCommentThreadSchema.shape),
    },
    async ({ cwd, ...input }, { signal }) =>
      result(async () => {
        const worktreeId = await worktreeFor(
          application,
          cwd ?? defaultCwd,
          signal,
        );
        return application.comments(
          { kind: 'create', worktreeId, ...input },
          principal,
          signal,
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
        ...replyToCommentSchema.shape,
      }),
    },
    async ({ cwd, ...input }, { signal }) =>
      result(async () => {
        const worktreeId = await worktreeFor(
          application,
          cwd ?? defaultCwd,
          signal,
        );
        return application.comments(
          { kind: 'reply', worktreeId, ...input },
          principal,
          signal,
        );
      }),
  );
  server.registerTool(
    'resolve_comment',
    {
      description: 'Resolve or reopen a review thread.',
      inputSchema: scopeSchema.extend({
        threadId: z.uuid(),
        ...resolveCommentSchema.shape,
      }),
    },
    async ({ cwd, ...input }, { signal }) =>
      result(async () => {
        const worktreeId = await worktreeFor(
          application,
          cwd ?? defaultCwd,
          signal,
        );
        return application.comments(
          { kind: 'resolve', worktreeId, ...input },
          principal,
          signal,
        );
      }),
  );
  return server;
}

async function worktreeFor(
  application: Application,
  cwd: string,
  signal?: AbortSignal,
) {
  const target = resolve(cwd);
  const inventory = (await application.inventory(signal)).inventory;
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
          text: JSON.stringify(toErrorResponse(error).body),
        },
      ],
    };
  }
}
