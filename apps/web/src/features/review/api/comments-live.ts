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
import type { CommentsPort } from '@/features/review/api/comments-port';

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
