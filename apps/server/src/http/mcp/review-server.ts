import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { uploadArtifactRequestSchema } from '@porcelain/contracts/artifacts';
import {
  commentScopeSchema,
  commentThreadScopeSchema,
  createCommentThreadSchema,
  replyToCommentSchema,
  resolveCommentSchema,
} from '@porcelain/contracts/comments';
import { fileQuerySchema } from '@porcelain/contracts/files';
import { replaceReviewLayersSchema } from '@porcelain/contracts/review-layers';
import { z } from 'zod';
import type { Application } from '../../application.ts';
import type { AuthenticatedPrincipal } from '../../models/principal.ts';
import { toErrorResponse } from '../mappers/error-response.ts';

export function createReviewMcpServer(
  application: Application,
  principal: AuthenticatedPrincipal,
) {
  const server = new McpServer(
    { name: 'porcelain', version: '1.0.0' },
    {
      instructions:
        'Porcelain is a review workspace. Use inventory to find a registered worktree. Publish ordered review layers and a concise handoff.md artifact; handoff.html can contain a readable report. Read reviewer comments when asked. Nothing is pushed to other agents. Comments created through these tools are attributed to the agent.',
    },
  );
  server.registerTool(
    'inventory',
    {
      description: 'List registered projects and worktrees.',
      inputSchema: z.strictObject({}),
      annotations: { readOnlyHint: true },
    },
    async () => result(() => application.inventory()),
  );
  server.registerTool(
    'git_status',
    {
      description:
        'Read current changes and branch state in a registered worktree.',
      inputSchema: commentScopeSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ worktreeId }, { signal }) =>
      result(() => application.gitStatus(worktreeId, signal)),
  );
  server.registerTool(
    'review_evidence',
    {
      description:
        'Read per-file review fingerprints and comparison identities for precise comments.',
      inputSchema: commentScopeSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ worktreeId }, { signal }) =>
      result(async () => {
        const observed = await application.reviewEvidence(worktreeId, signal);
        return {
          ...observed,
          evidence: observed.evidence.map(
            ({ path, fingerprint, comparisons }) => ({
              path,
              fingerprint,
              changes: comparisons.map(({ change }) => change),
            }),
          ),
        };
      }),
  );
  server.registerTool(
    'read_file',
    {
      description:
        'Read a UTF-8 file and its content fingerprint without following symlinks.',
      inputSchema: commentScopeSchema.extend(fileQuerySchema.shape),
      annotations: { readOnlyHint: true },
    },
    async ({ worktreeId, path }, { signal }) =>
      result(() => application.readTextFile(worktreeId, path, signal)),
  );
  server.registerTool(
    'list_comments',
    {
      description:
        'Read review threads, replies and resolved state for a worktree.',
      inputSchema: commentScopeSchema,
      annotations: { readOnlyHint: true },
    },
    async (input, { signal }) =>
      result(() =>
        application.comments({ ...input, kind: 'list' }, principal, signal),
      ),
  );
  server.registerTool(
    'create_comment',
    {
      description:
        'Create an agent review thread on a file or code range. For precise placement include comparison and content fingerprint from the reviewed evidence.',
      inputSchema: commentScopeSchema.extend(createCommentThreadSchema.shape),
    },
    async (input, { signal }) =>
      result(() =>
        application.comments({ ...input, kind: 'create' }, principal, signal),
      ),
  );
  server.registerTool(
    'reply_to_comment',
    {
      description: 'Reply to a reviewer or agent thread.',
      inputSchema: commentThreadScopeSchema.extend(replyToCommentSchema.shape),
    },
    async (input, { signal }) =>
      result(() =>
        application.comments({ ...input, kind: 'reply' }, principal, signal),
      ),
  );
  server.registerTool(
    'resolve_comment',
    {
      description: 'Resolve or reopen a review thread.',
      inputSchema: commentThreadScopeSchema.extend(resolveCommentSchema.shape),
    },
    async (input, { signal }) =>
      result(() =>
        application.comments({ ...input, kind: 'resolve' }, principal, signal),
      ),
  );
  server.registerTool(
    'read_layers',
    {
      description:
        'Read ordered review layers and their revision before replacing them.',
      inputSchema: commentScopeSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ worktreeId }) =>
      result(() => application.reviewLayers(worktreeId)),
  );
  server.registerTool(
    'replace_layers',
    {
      description:
        'Publish ordered layers with titles, summaries and file notes. Preserve unrelated layers and supply the revision returned by read_layers.',
      inputSchema: commentScopeSchema.extend(replaceReviewLayersSchema.shape),
    },
    async ({ worktreeId, expectedRevision, layers }) =>
      result(() =>
        application.replaceReviewLayers(worktreeId, expectedRevision, layers),
      ),
  );
  server.registerTool(
    'publish_artifact',
    {
      description:
        'Publish a UTF-8 review artifact such as handoff.md or handoff.html. Markdown should give a short explanation and verification results.',
      inputSchema: commentScopeSchema.extend(uploadArtifactRequestSchema.shape),
    },
    async ({ worktreeId, ...input }, { signal }) =>
      result(() => application.uploadArtifact(worktreeId, input, signal)),
  );
  return server;
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
