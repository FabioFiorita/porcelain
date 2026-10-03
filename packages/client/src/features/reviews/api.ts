import {
  readPublishedReviewEndpoint,
  readProofFileEndpoint,
  listReviewedFilesEndpoint,
  listReviewedLayersEndpoint,
  listCommentThreadsEndpoint,
} from '@porcelain/contracts/reviews';

import { requestEndpoint } from '../../shared/api/request.ts';
import { perConnection } from '../../shared/api/per-connection.ts';
import { type Transport } from '../../shared/api/transport.ts';

function onBranch(range: { branch: string | undefined }) {
  return range.branch === undefined ? {} : { branch: range.branch };
}

type ReadScope = { worktreeId: string; signal: AbortSignal };
type ReviewRange =
  | { kind: 'worktree' }
  | { kind: 'branch'; branch: string | undefined };

function createReviewsApi(transport: Transport) {
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
    }: ReadScope & { proofId: string }) =>
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
      }: ReadScope & { range: ReviewRange }) =>
        requestEndpoint(transport, listReviewedFilesEndpoint, {
          params: { worktreeId },
          query:
            range.kind === 'branch'
              ? { scope: 'branch', ...onBranch(range) }
              : {},
          signal,
        }),
    },
    reviewedLayers: {
      list: ({ worktreeId, signal }: ReadScope) =>
        requestEndpoint(transport, listReviewedLayersEndpoint, {
          params: { worktreeId },
          signal,
        }),
    },
  };
}

function createCommentsApi(transport: Transport) {
  return {
    list: ({ worktreeId, signal }: ReadScope) =>
      requestEndpoint(transport, listCommentThreadsEndpoint, {
        params: { worktreeId },
        signal,
      }),
  };
}
export const reviewsApi = perConnection(createReviewsApi);
export const commentsApi = perConnection(createCommentsApi);
