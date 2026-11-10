import { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api';
import { porcelainApi } from '../shared/http-api.ts';
import { PairedRequest } from '../shared/http-caller.ts';
import { httpFailure } from '../shared/http-failure.ts';
import { worktreeFailures } from '../shared/worktree-failures.ts';
import { gitReadFailures } from '../shared/git-read-failures.ts';
import { worktreeParamsSchema } from '../shared/worktree-params.ts';
import {
  BranchBaseNotFoundError,
  UnbornBranchError,
  UnrelatedBranchError,
} from '@porcelain/changes/errors';
import { ReviewedMarkConflictError } from '@porcelain/reviews/errors';
import {
  listReviewedFilesQuerySchema,
  listReviewedFilesResponseSchema,
  setReviewedFileRequestSchema,
  setReviewedFileResponseSchema,
  setReviewedFilesRequestSchema,
  setReviewedFilesResponseSchema,
  removeReviewedFileQuerySchema,
  removeReviewedFileResponseSchema,
  removeReviewedFilesRequestSchema,
  removeReviewedFilesResponseSchema,
} from './reviewed-files.ts';

export class ReviewedFilesApi extends porcelainApi.add(
  HttpApiGroup.make('reviewedFiles')
    .add(
      HttpApiEndpoint.get(
        'listReviewedFiles',
        '/api/worktrees/:worktreeId/reviewed',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          query: listReviewedFilesQuerySchema.fields,
          success: listReviewedFilesResponseSchema,
          error: [...worktreeFailures],
        },
      ),
      HttpApiEndpoint.put(
        'setReviewedFile',
        '/api/worktrees/:worktreeId/reviewed',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          payload: setReviewedFileRequestSchema,
          success: setReviewedFileResponseSchema,
          error: [
            ...worktreeFailures,
            ...gitReadFailures,
            httpFailure(ReviewedMarkConflictError, 'Conflict'),
            httpFailure(BranchBaseNotFoundError, 'NotFound'),
            httpFailure(UnbornBranchError, 'Conflict'),
            httpFailure(UnrelatedBranchError, 'Conflict'),
          ],
        },
      ),
      HttpApiEndpoint.put(
        'setReviewedFiles',
        '/api/worktrees/:worktreeId/reviewed-bulk',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          payload: setReviewedFilesRequestSchema,
          success: setReviewedFilesResponseSchema,
          error: [
            ...worktreeFailures,
            ...gitReadFailures,
            httpFailure(ReviewedMarkConflictError, 'Conflict'),
            httpFailure(BranchBaseNotFoundError, 'NotFound'),
            httpFailure(UnbornBranchError, 'Conflict'),
            httpFailure(UnrelatedBranchError, 'Conflict'),
          ],
        },
      ),
      HttpApiEndpoint.delete(
        'removeReviewedFile',
        '/api/worktrees/:worktreeId/reviewed',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          query: removeReviewedFileQuerySchema.fields,
          success: removeReviewedFileResponseSchema,
          error: worktreeFailures,
        },
      ),
      HttpApiEndpoint.delete(
        'removeReviewedFiles',
        '/api/worktrees/:worktreeId/reviewed-bulk',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          payload: removeReviewedFilesRequestSchema,
          success: removeReviewedFilesResponseSchema,
          error: worktreeFailures,
        },
      ),
    )
    .middleware(PairedRequest),
) {}
