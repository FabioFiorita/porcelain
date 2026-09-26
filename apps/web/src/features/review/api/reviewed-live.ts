import {
  listReviewedFilesResponseSchema,
  listReviewedLayersResponseSchema,
  removeReviewedFileResponseSchema,
  removeReviewedLayerResponseSchema,
  setReviewedFileRequestSchema,
  setReviewedFileResponseSchema,
  setReviewedFilesRequestSchema,
  setReviewedFilesResponseSchema,
  setReviewedLayerRequestSchema,
  setReviewedLayerResponseSchema,
} from '@porcelain/contracts/reviews';
import { requestJson } from '@/shared/api/request';
import type { ReviewPort } from './review-port';
import { jsonBody, queryString, worktreePath } from './review-request';

export function createReviewedLive(
  transport: typeof fetch,
): Pick<ReviewPort, 'reviewed' | 'reviewedLayers'> {
  return {
    reviewed: {
      list: ({ worktreeId, signal }) =>
        requestJson(
          transport,
          `${worktreePath(worktreeId)}/reviewed`,
          listReviewedFilesResponseSchema,
          { signal },
        ),
      set: ({ worktreeId, signal, input }) =>
        requestJson(
          transport,
          `${worktreePath(worktreeId)}/reviewed`,
          setReviewedFileResponseSchema,
          {
            method: 'PUT',
            ...jsonBody(setReviewedFileRequestSchema.parse(input)),
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
            ...jsonBody(setReviewedFilesRequestSchema.parse(input)),
            signal,
          },
        ),
      remove: ({ worktreeId, signal, path }) =>
        requestJson(
          transport,
          `${worktreePath(worktreeId)}/reviewed${queryString({ path })}`,
          removeReviewedFileResponseSchema,
          { method: 'DELETE', signal },
        ),
    },
    reviewedLayers: {
      list: ({ worktreeId, signal }) =>
        requestJson(
          transport,
          `${worktreePath(worktreeId)}/reviewed-layers`,
          listReviewedLayersResponseSchema,
          { signal },
        ),
      set: ({ worktreeId, signal, input }) =>
        requestJson(
          transport,
          `${worktreePath(worktreeId)}/reviewed-layers`,
          setReviewedLayerResponseSchema,
          {
            method: 'PUT',
            ...jsonBody(setReviewedLayerRequestSchema.parse(input)),
            signal,
          },
        ),
      remove: ({ worktreeId, signal, layerId }) =>
        requestJson(
          transport,
          `${worktreePath(worktreeId)}/reviewed-layers${queryString({ layerId })}`,
          removeReviewedLayerResponseSchema,
          { method: 'DELETE', signal },
        ),
    },
  };
}
