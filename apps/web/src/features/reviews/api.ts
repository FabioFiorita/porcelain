import {
  listReviewedFilesResponseSchema,
  listReviewedLayersResponseSchema,
  readPublishedReviewResponseSchema,
  removeReviewedFileResponseSchema,
  removeReviewedFilesRequestSchema,
  removeReviewedFilesResponseSchema,
  removeReviewedLayerResponseSchema,
  setReviewedFileRequestSchema,
  setReviewedFileResponseSchema,
  setReviewedFilesRequestSchema,
  setReviewedFilesResponseSchema,
  setReviewedLayerRequestSchema,
  setReviewedLayerResponseSchema,
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
import type { CommentsPort } from './rules/comments';
import type { ReviewsPort } from './rules/reviewed';
export type { CommentsPort } from './rules/comments';
export type { ReviewsPort } from './rules/reviewed';

function worktreePath(worktreeId: string) {
  return `/api/worktrees/${encodeURIComponent(worktreeId)}`;
}

function json(body: unknown) {
  return {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function createCommentsLive(transport: typeof fetch): CommentsPort {
  const path = (worktreeId: string) => `${worktreePath(worktreeId)}/comments`;
  const threadPath = (worktreeId: string, threadId: string) =>
    `${path(worktreeId)}/${encodeURIComponent(threadId)}`;
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

export function createReviewsLive(transport: typeof fetch): ReviewsPort {
  const reviewed = (worktreeId: string) =>
    `${worktreePath(worktreeId)}/reviewed`;
  const layers = (worktreeId: string) =>
    `${worktreePath(worktreeId)}/reviewed-layers`;
  return {
    review: async ({ worktreeId, signal }) =>
      (
        await requestJson(
          transport,
          `${worktreePath(worktreeId)}/review`,
          readPublishedReviewResponseSchema,
          { signal },
        )
      ).review ?? null,
    reviewed: {
      list: ({ worktreeId, signal }) =>
        requestJson(
          transport,
          reviewed(worktreeId),
          listReviewedFilesResponseSchema,
          { signal },
        ),
      set: ({ worktreeId, signal, input }) =>
        requestJson(
          transport,
          reviewed(worktreeId),
          setReviewedFileResponseSchema,
          {
            method: 'PUT',
            ...json(setReviewedFileRequestSchema.parse(input)),
            signal,
          },
        ),
      setAll: ({ worktreeId, signal, input }) =>
        requestJson(
          transport,
          `${worktreePath(worktreeId)}/reviewed-bulk`,
          setReviewedFilesResponseSchema,
          {
            method: 'PUT',
            ...json(setReviewedFilesRequestSchema.parse(input)),
            signal,
          },
        ),
      remove: ({ worktreeId, signal, path }) =>
        requestJson(
          transport,
          `${reviewed(worktreeId)}?${new URLSearchParams({ path })}`,
          removeReviewedFileResponseSchema,
          { method: 'DELETE', signal },
        ),
      removeAll: ({ worktreeId, signal, paths }) =>
        requestJson(
          transport,
          `${worktreePath(worktreeId)}/reviewed-bulk`,
          removeReviewedFilesResponseSchema,
          {
            method: 'DELETE',
            ...json(removeReviewedFilesRequestSchema.parse({ paths })),
            signal,
          },
        ),
    },
    reviewedLayers: {
      list: ({ worktreeId, signal }) =>
        requestJson(
          transport,
          layers(worktreeId),
          listReviewedLayersResponseSchema,
          { signal },
        ),
      set: ({ worktreeId, signal, input }) =>
        requestJson(
          transport,
          layers(worktreeId),
          setReviewedLayerResponseSchema,
          {
            method: 'PUT',
            ...json(setReviewedLayerRequestSchema.parse(input)),
            signal,
          },
        ),
      remove: ({ worktreeId, signal, layerId }) =>
        requestJson(
          transport,
          `${layers(worktreeId)}?${new URLSearchParams({ layerId })}`,
          removeReviewedLayerResponseSchema,
          { method: 'DELETE', signal },
        ),
    },
  };
}
