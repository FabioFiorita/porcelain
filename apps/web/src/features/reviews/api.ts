import {
  listReviewedFilesResponseSchema,
  listReviewedLayersResponseSchema,
  readProofFileResponseSchema,
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
  deleteCommentMessageResponseSchema,
  editCommentMessageRequestSchema,
  editCommentMessageResponseSchema,
  listCommentThreadsResponseSchema,
  markCommentsSeenResponseSchema,
  replyToCommentRequestSchema,
  replyToCommentResponseSchema,
  updateCommentThreadRequestSchema,
  updateCommentThreadResponseSchema,
} from '@porcelain/contracts/reviews';
import { requestJson } from '@/shared/api/request';
import type { CommentsPort } from './rules/comments';
import type { ReviewRange, ReviewsPort } from './rules/reviewed';
export type { CommentsPort } from './rules/comments';
export type { ReviewsPort } from './rules/reviewed';

function worktreePath(worktreeId: string) {
  return `/api/worktrees/${encodeURIComponent(worktreeId)}`;
}

function inRange(range: ReviewRange) {
  return range.kind === 'branch'
    ? { scope: 'branch' as const, base: range.base }
    : {};
}

function onBranch(range: { branch: string | undefined }) {
  return range.branch === undefined ? {} : { branch: range.branch };
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
    edit: async ({ worktreeId, threadId, messageId, body, signal }) => [
      await requestJson(
        transport,
        `${threadPath(worktreeId, threadId)}/messages`,
        editCommentMessageResponseSchema,
        {
          method: 'PATCH',
          ...json(editCommentMessageRequestSchema.parse({ messageId, body })),
          signal,
        },
      ),
    ],
    remove: ({ worktreeId, threadId, messageId, signal }) =>
      requestJson(
        transport,
        `${threadPath(worktreeId, threadId)}/messages?${new URLSearchParams({ messageId })}`,
        deleteCommentMessageResponseSchema,
        { method: 'DELETE', signal },
      ),
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
    proofFile: ({ worktreeId, proofId, signal }) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/review/proof?${new URLSearchParams({ proofId })}`,
        readProofFileResponseSchema,
        { signal },
      ),
    reviewed: {
      list: ({ worktreeId, signal, range }) =>
        requestJson(
          transport,
          `${reviewed(worktreeId)}${range.kind === 'branch' ? `?${new URLSearchParams({ scope: 'branch', ...onBranch(range) })}` : ''}`,
          listReviewedFilesResponseSchema,
          { signal },
        ),
      set: ({ worktreeId, signal, range, input }) =>
        requestJson(
          transport,
          reviewed(worktreeId),
          setReviewedFileResponseSchema,
          {
            method: 'PUT',
            ...json(
              setReviewedFileRequestSchema.parse({
                ...input,
                reviewed: true,
                ...inRange(range),
              }),
            ),
            signal,
          },
        ),
      setAll: ({ worktreeId, signal, range, input }) =>
        requestJson(
          transport,
          `${worktreePath(worktreeId)}/reviewed-bulk`,
          setReviewedFilesResponseSchema,
          {
            method: 'PUT',
            ...json(
              setReviewedFilesRequestSchema.parse({
                ...input,
                ...inRange(range),
              }),
            ),
            signal,
          },
        ),
      remove: ({ worktreeId, signal, range, path }) =>
        requestJson(
          transport,
          `${reviewed(worktreeId)}?${new URLSearchParams(
            range.kind === 'branch'
              ? { path, scope: 'branch', ...onBranch(range) }
              : { path },
          )}`,
          removeReviewedFileResponseSchema,
          { method: 'DELETE', signal },
        ),
      removeAll: ({ worktreeId, signal, range, paths }) =>
        requestJson(
          transport,
          `${worktreePath(worktreeId)}/reviewed-bulk`,
          removeReviewedFilesResponseSchema,
          {
            method: 'DELETE',
            ...json(
              removeReviewedFilesRequestSchema.parse(
                range.kind === 'branch'
                  ? { paths, scope: 'branch', ...onBranch(range) }
                  : { paths },
              ),
            ),
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
