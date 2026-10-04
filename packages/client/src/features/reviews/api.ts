import type { EndpointArguments } from '../../shared/api/request.ts';
import {
  readPublishedReviewEndpoint,
  readProofFileEndpoint,
  listReviewedFilesEndpoint,
  listReviewedLayersEndpoint,
  listCommentThreadsEndpoint,
} from '@porcelain/contracts/reviews';
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

import { requestEndpoint } from '../../shared/api/request.ts';
import type { CommentsPort } from './ports/comments.ts';
import type { ReviewRange, ReviewsPort } from './ports/reviews.ts';
import { perConnection } from '../../shared/api/per-connection.ts';
import type { Transport } from '../../shared/api/transport.ts';

type ReadScope = EndpointArguments<typeof readPublishedReviewEndpoint>;

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
    list: ({ worktreeId, signal }: ReadScope) =>
      requestEndpoint(transport, listCommentThreadsEndpoint, {
        params: { worktreeId },
        signal,
      }),
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
    review: async ({ worktreeId, signal }: ReadScope) =>
      (
        await requestEndpoint(transport, readPublishedReviewEndpoint, {
          params: { worktreeId },
          signal,
        })
      ).review ?? null,
    proofFile: ({
      worktreeId,
      proofId,
      signal,
    }: EndpointArguments<typeof readProofFileEndpoint>) =>
      requestEndpoint(transport, readProofFileEndpoint, {
        params: { worktreeId },
        query: { proofId },
        signal,
      }),
    reviewed: {
      list: ({
        worktreeId,
        signal,
        range,
      }: ReadScope & {
        range:
          | { kind: 'worktree' }
          | { kind: 'branch'; branch: string | undefined };
      }) =>
        requestEndpoint(transport, listReviewedFilesEndpoint, {
          params: { worktreeId },
          query:
            range.kind === 'branch'
              ? { scope: 'branch', ...onBranch(range) }
              : {},
          signal,
        }),
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
      list: ({ worktreeId, signal }: ReadScope) =>
        requestEndpoint(transport, listReviewedLayersEndpoint, {
          params: { worktreeId },
          signal,
        }),
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
