import {
  createCommentThreadEndpoint,
  replyToCommentEndpoint,
  updateCommentThreadEndpoint,
  editCommentMessageEndpoint,
  deleteCommentMessageEndpoint,
  deleteResolvedCommentsEndpoint,
  markCommentsSeenEndpoint,
  setReviewedFileEndpoint,
  setReviewedFilesEndpoint,
  removeReviewedFileEndpoint,
  removeReviewedFilesEndpoint,
  setReviewedLayerEndpoint,
  removeReviewedLayerEndpoint,
} from '@porcelain/contracts/reviews';
import {
  reviewsApi as sharedReviewsApi,
  commentsApi as sharedCommentsApi,
} from '@porcelain/client/reviews/api';

import { requestEndpoint } from '@porcelain/client/transport';
import type { CommentsPort } from './rules/comments';
import type { ReviewRange, ReviewsPort } from './rules/reviewed';
import { perConnection } from '@porcelain/client/transport';
import type { Transport } from '@porcelain/client/transport';

function inRange(range: ReviewRange) {
  return range.kind === 'branch'
    ? { scope: 'branch' as const, base: range.base }
    : {};
}

function onBranch(range: { branch: string | undefined }) {
  return range.branch === undefined ? {} : { branch: range.branch };
}

function createCommentsApi(transport: Transport): CommentsPort {
  return {
    ...sharedCommentsApi({ transport }),
    create: async ({ worktreeId, signal, input }) => [
      await requestEndpoint(transport, createCommentThreadEndpoint, {
        params: { worktreeId },
        body: input,
        signal,
      }),
    ],
    reply: async ({ worktreeId, threadId, signal, input }) => [
      await requestEndpoint(transport, replyToCommentEndpoint, {
        params: { worktreeId, threadId },
        body: input,
        signal,
      }),
    ],
    resolve: async ({ worktreeId, threadId, signal, input }) => [
      await requestEndpoint(transport, updateCommentThreadEndpoint, {
        params: { worktreeId, threadId },
        body: input,
        signal,
      }),
    ],
    edit: async ({ worktreeId, threadId, messageId, body, signal }) => [
      await requestEndpoint(transport, editCommentMessageEndpoint, {
        params: { worktreeId, threadId },
        body: { messageId, body },
        signal,
      }),
    ],
    remove: ({ worktreeId, threadId, messageId, signal }) =>
      requestEndpoint(transport, deleteCommentMessageEndpoint, {
        params: { worktreeId, threadId },
        query: { messageId },
        signal,
      }),
    removeResolved: ({ worktreeId, threads, signal }) =>
      requestEndpoint(transport, deleteResolvedCommentsEndpoint, {
        params: { worktreeId },
        body: { threads },
        signal,
      }),
    seen: ({ worktreeId, throughRevision, signal }) =>
      requestEndpoint(transport, markCommentsSeenEndpoint, {
        params: { worktreeId },
        body: { throughRevision },
        signal,
      }),
  };
}

function createReviewsApi(transport: Transport): ReviewsPort {
  return {
    ...sharedReviewsApi({ transport }),
    reviewed: {
      ...sharedReviewsApi({ transport }).reviewed,
      set: ({ worktreeId, signal, range, input }) =>
        requestEndpoint(transport, setReviewedFileEndpoint, {
          params: { worktreeId },
          body: {
            ...input,
            reviewed: true,
            ...inRange(range),
          },
          signal,
        }),
      setAll: ({ worktreeId, signal, range, input }) =>
        requestEndpoint(transport, setReviewedFilesEndpoint, {
          params: { worktreeId },
          body: {
            ...input,
            ...inRange(range),
          },
          signal,
        }),
      remove: ({ worktreeId, signal, range, path }) =>
        requestEndpoint(transport, removeReviewedFileEndpoint, {
          params: { worktreeId },
          query:
            range.kind === 'branch'
              ? { path, scope: 'branch', ...onBranch(range) }
              : { path },
          signal,
        }),
      removeAll: ({ worktreeId, signal, range, paths }) =>
        requestEndpoint(transport, removeReviewedFilesEndpoint, {
          params: { worktreeId },
          body:
            range.kind === 'branch'
              ? { paths: [...paths], scope: 'branch', ...onBranch(range) }
              : { paths: [...paths] },
          signal,
        }),
    },
    reviewedLayers: {
      ...sharedReviewsApi({ transport }).reviewedLayers,
      set: ({ worktreeId, signal, input }) =>
        requestEndpoint(transport, setReviewedLayerEndpoint, {
          params: { worktreeId },
          body: input,
          signal,
        }),
      remove: ({ worktreeId, signal, layerId }) =>
        requestEndpoint(transport, removeReviewedLayerEndpoint, {
          params: { worktreeId },
          query: { layerId },
          signal,
        }),
    },
  };
}

export const commentsApi = perConnection(createCommentsApi);
export const reviewsApi = perConnection(createReviewsApi);
