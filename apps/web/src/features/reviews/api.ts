import {
  createCommentThreadRequestSchema,
  createCommentThreadResponseSchema,
  listCommentThreadsResponseSchema,
  markCommentsSeenResponseSchema,
  replyToCommentRequestSchema,
  replyToCommentResponseSchema,
  updateCommentThreadRequestSchema,
  updateCommentThreadResponseSchema,
} from '@porcelain/contracts/reviews';
import { requestJson } from '@/shared/api/request';
import type {
  CommentResolution,
  CommentThread,
  NewComment,
  NewReply,
} from './rules/comments';

type CommentRequest = {
  projectId: string;
  worktreeId: string;
  signal: AbortSignal;
};
export type CommentsPort = {
  list: (request: CommentRequest) => Promise<CommentThread[]>;
  create: (
    request: CommentRequest & { input: NewComment },
  ) => Promise<CommentThread[]>;
  reply: (
    request: CommentRequest & { threadId: string; input: NewReply },
  ) => Promise<CommentThread[]>;
  resolve: (
    request: CommentRequest & { threadId: string; input: CommentResolution },
  ) => Promise<CommentThread[]>;
  seen: (
    request: CommentRequest & { throughRevision: number },
  ) => Promise<{ worktreeId: string; seenThrough: number }>;
};

export function createCommentsLive(transport: typeof fetch): CommentsPort {
  const path = (worktreeId: string) =>
    `/api/worktrees/${encodeURIComponent(worktreeId)}/comments`;
  const threadPath = (worktreeId: string, threadId: string) =>
    `${path(worktreeId)}/${encodeURIComponent(threadId)}`;
  const json = (body: unknown) => ({
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    list: ({ worktreeId, signal }) =>
      requestJson(
        transport,
        path(worktreeId),
        listCommentThreadsResponseSchema,
        { signal },
      ),
    create: async ({ worktreeId, signal, input }) => [
      await requestJson(
        transport,
        path(worktreeId),
        createCommentThreadResponseSchema,
        {
          method: 'POST',
          ...json(createCommentThreadRequestSchema.parse(input)),
          signal,
        },
      ),
    ],
    reply: async ({ worktreeId, threadId, signal, input }) => [
      await requestJson(
        transport,
        `${threadPath(worktreeId, threadId)}/replies`,
        replyToCommentResponseSchema,
        {
          method: 'POST',
          ...json(replyToCommentRequestSchema.parse(input)),
          signal,
        },
      ),
    ],
    resolve: async ({ worktreeId, threadId, signal, input }) => [
      await requestJson(
        transport,
        `${threadPath(worktreeId, threadId)}/resolution`,
        updateCommentThreadResponseSchema,
        {
          method: 'PUT',
          ...json(updateCommentThreadRequestSchema.parse(input)),
          signal,
        },
      ),
    ],
    seen: ({ worktreeId, throughRevision, signal }) =>
      requestJson(
        transport,
        `${path(worktreeId)}/seen`,
        markCommentsSeenResponseSchema,
        {
          method: 'POST',
          ...json({ throughRevision }),
          signal,
        },
      ),
  };
}
