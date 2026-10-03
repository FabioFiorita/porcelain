import {
  readPublishedReviewResponseSchema,
  readProofFileResponseSchema,
  listReviewedFilesResponseSchema,
  listReviewedLayersResponseSchema,
  listCommentThreadsResponseSchema,
} from '@porcelain/contracts/reviews';
import { requestJson } from '../../shared/api/request.ts';
import { perConnection } from '../../shared/api/per-connection.ts';
import { type Transport } from '../../shared/api/transport.ts';

function worktreePath(worktreeId: string) {
  return `/api/worktrees/${encodeURIComponent(worktreeId)}`;
}

function onBranch(range: { branch: string | undefined }) {
  return range.branch === undefined ? {} : { branch: range.branch };
}

type ReadScope = { worktreeId: string; signal: AbortSignal };
type ReviewRange =
  | { kind: 'worktree' }
  | { kind: 'branch'; branch: string | undefined };

function createReviewsApi(transport: Transport) {
  const reviewed = (worktreeId: string) =>
    `${worktreePath(worktreeId)}/reviewed`;
  const layers = (worktreeId: string) =>
    `${worktreePath(worktreeId)}/reviewed-layers`;
  return {
    review: async ({ worktreeId, signal }: ReadScope) =>
      (
        await requestJson(
          transport,
          `${worktreePath(worktreeId)}/review`,
          readPublishedReviewResponseSchema,
          { signal },
        )
      ).review ?? null,
    proofFile: ({
      worktreeId,
      proofId,
      signal,
    }: ReadScope & { proofId: string }) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/review/proof?${new URLSearchParams({ proofId }).toString()}`,
        readProofFileResponseSchema,
        { signal },
      ),
    reviewed: {
      list: ({
        worktreeId,
        signal,
        range,
      }: ReadScope & { range: ReviewRange }) =>
        requestJson(
          transport,
          `${reviewed(worktreeId)}${range.kind === 'branch' ? `?${new URLSearchParams({ scope: 'branch', ...onBranch(range) }).toString()}` : ''}`,
          listReviewedFilesResponseSchema,
          { signal },
        ),
    },
    reviewedLayers: {
      list: ({ worktreeId, signal }: ReadScope) =>
        requestJson(
          transport,
          layers(worktreeId),
          listReviewedLayersResponseSchema,
          { signal },
        ),
    },
  };
}

function createCommentsApi(transport: Transport) {
  return {
    list: ({ worktreeId, signal }: ReadScope) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/comments`,
        listCommentThreadsResponseSchema,
        { signal },
      ),
  };
}
export const reviewsApi = perConnection(createReviewsApi);
export const commentsApi = perConnection(createCommentsApi);
