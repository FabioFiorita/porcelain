import { environmentUnavailable } from '../shared/environment-failure.ts';
import { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api';
import { porcelainApi } from '../shared/http-api.ts';
import { PairedRequest } from '../shared/http-caller.ts';
import { httpFailure } from '../shared/http-failure.ts';
import { worktreeFailures } from '../shared/worktree-failures.ts';
import { gitReadFailures } from '../shared/git-read-failures.ts';
import { worktreeParamsSchema } from '../shared/worktree-params.ts';
import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import {
  IncompleteDiffReadError,
  BranchBaseNotFoundError,
  UnbornBranchError,
  UnrelatedBranchError,
} from '@porcelain/changes/errors';
import {
  CommentIdentityConflictError,
  CommentLimitExceededError,
  CommentRevisionMismatchError,
  UnsupportedCommentComparisonError,
  CommentTargetNotFoundError,
  CommentAuthorMismatchError,
  DuplicateLayerIdError,
  DuplicateStepIdError,
  StepLaneOutOfRangeError,
  InvalidDecisionBoxError,
  UnknownBoxLayerError,
  UnknownArrowBoxError,
  UnknownProofTargetError,
  ReviewConflictError,
  ProofTooLargeError,
  UnknownProofFileError,
  UnsupportedProofFileError,
  ProofFileUnreadableError,
  ProofFileNotFoundError,
  ReviewedMarkConflictError,
  ReviewLayerNotFoundError,
} from '@porcelain/reviews/errors';
import {
  commentThreadParamsSchema,
  createCommentThreadRequestSchema,
  createCommentThreadResponseSchema,
  deleteCommentMessageQuerySchema,
  deleteCommentMessageResponseSchema,
  deleteResolvedCommentsRequestSchema,
  deleteResolvedCommentsResponseSchema,
  editCommentMessageRequestSchema,
  editCommentMessageResponseSchema,
  listCommentThreadsResponseSchema,
  markCommentsSeenRequestSchema,
  markCommentsSeenResponseSchema,
  replyToCommentRequestSchema,
  replyToCommentResponseSchema,
  updateCommentThreadRequestSchema,
  updateCommentThreadResponseSchema,
} from './comments.ts';
import {
  readProofFileQuerySchema,
  readProofFileResponseSchema,
} from './review-proof.ts';
import {
  publishReviewRequestSchema,
  publishReviewResponseSchema,
  readPublishedReviewResponseSchema,
} from './review.ts';
import {
  listReviewedFilesQuerySchema,
  listReviewedFilesResponseSchema,
  listReviewedLayersResponseSchema,
  removeReviewedFileQuerySchema,
  removeReviewedFileResponseSchema,
  removeReviewedFilesRequestSchema,
  removeReviewedFilesResponseSchema,
  removeReviewedLayerQuerySchema,
  removeReviewedLayerResponseSchema,
  setReviewedFileRequestSchema,
  setReviewedFileResponseSchema,
  setReviewedFilesRequestSchema,
  setReviewedFilesResponseSchema,
  setReviewedLayerRequestSchema,
  setReviewedLayerResponseSchema,
} from './reviewed-files.ts';

export class ReviewsApi extends porcelainApi.add(
  HttpApiGroup.make('reviews')
    .add(
      HttpApiEndpoint.post(
        'createCommentThread',
        '/api/worktrees/:worktreeId/comments',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          payload: createCommentThreadRequestSchema,
          success: createCommentThreadResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(CommentIdentityConflictError, 'Conflict'),
            httpFailure(CommentLimitExceededError, 'Conflict'),
            httpFailure(InvalidLineRangeError, 'BadRequest', {
              message: 'Invalid request',
            }),
            httpFailure(CommentRevisionMismatchError, 'BadRequest', {
              message: 'Invalid request',
            }),
            httpFailure(UnsupportedCommentComparisonError, 'BadRequest', {
              message: 'Invalid request',
            }),
          ],
        },
      ),
      HttpApiEndpoint.delete(
        'deleteCommentMessage',
        '/api/worktrees/:worktreeId/comments/:threadId/messages',
        {
          disableCodecs: true,
          params: commentThreadParamsSchema,
          query: deleteCommentMessageQuerySchema.fields,
          success: deleteCommentMessageResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(CommentTargetNotFoundError, 'NotFound', {
              message: 'Comment target not found',
            }),
            httpFailure(CommentAuthorMismatchError, 'Forbidden'),
          ],
        },
      ),
      HttpApiEndpoint.post(
        'deleteResolvedComments',
        '/api/worktrees/:worktreeId/comments/resolved/deletion',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          payload: deleteResolvedCommentsRequestSchema,
          success: deleteResolvedCommentsResponseSchema,
          error: [...worktreeFailures],
        },
      ),
      HttpApiEndpoint.patch(
        'editCommentMessage',
        '/api/worktrees/:worktreeId/comments/:threadId/messages',
        {
          disableCodecs: true,
          params: commentThreadParamsSchema,
          payload: editCommentMessageRequestSchema,
          success: editCommentMessageResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(CommentTargetNotFoundError, 'NotFound', {
              message: 'Comment target not found',
            }),
            httpFailure(CommentAuthorMismatchError, 'Forbidden'),
            httpFailure(CommentLimitExceededError, 'Conflict'),
          ],
        },
      ),
      HttpApiEndpoint.get(
        'listCommentThreads',
        '/api/worktrees/:worktreeId/comments',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          success: listCommentThreadsResponseSchema,
          error: [...worktreeFailures],
        },
      ),
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
      HttpApiEndpoint.get(
        'listReviewedLayers',
        '/api/worktrees/:worktreeId/reviewed-layers',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          success: listReviewedLayersResponseSchema,
          error: [...worktreeFailures],
        },
      ),
      HttpApiEndpoint.post(
        'markCommentsSeen',
        '/api/worktrees/:worktreeId/comments/seen',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          payload: markCommentsSeenRequestSchema,
          success: markCommentsSeenResponseSchema,
          error: [...worktreeFailures],
        },
      ),
      HttpApiEndpoint.put(
        'publishReview',
        '/api/worktrees/:worktreeId/review',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          payload: publishReviewRequestSchema,
          success: publishReviewResponseSchema,
          error: [
            environmentUnavailable,
            ...worktreeFailures,
            ...gitReadFailures,
            httpFailure(DuplicateLayerIdError, 'BadRequest', {
              message: 'Invalid request',
            }),
            httpFailure(DuplicateStepIdError, 'BadRequest', {
              message: 'Invalid request',
            }),
            httpFailure(InvalidLineRangeError, 'BadRequest', {
              message: 'Invalid request',
            }),
            httpFailure(StepLaneOutOfRangeError, 'BadRequest', {
              message: 'Invalid request',
            }),
            httpFailure(InvalidDecisionBoxError, 'BadRequest', {
              message: 'Invalid request',
            }),
            httpFailure(UnknownBoxLayerError, 'BadRequest', {
              message: 'Invalid request',
            }),
            httpFailure(UnknownArrowBoxError, 'BadRequest', {
              message: 'Invalid request',
            }),
            httpFailure(UnknownProofTargetError, 'BadRequest'),
            httpFailure(ReviewConflictError, 'Conflict'),
            httpFailure(ProofTooLargeError, 'PayloadTooLarge'),
            httpFailure(UnknownProofFileError, 'BadRequest'),
            httpFailure(UnsupportedProofFileError, 'UnprocessableEntity'),
            httpFailure(ProofFileUnreadableError, 'UnprocessableEntity'),
            httpFailure(IncompleteDiffReadError, 'UnprocessableEntity'),
          ],
        },
      ),
      HttpApiEndpoint.get(
        'readProofFile',
        '/api/worktrees/:worktreeId/review/proof',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          query: readProofFileQuerySchema.fields,
          success: readProofFileResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(ProofFileNotFoundError, 'NotFound'),
          ],
        },
      ),
      HttpApiEndpoint.get(
        'readPublishedReview',
        '/api/worktrees/:worktreeId/review',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          success: readPublishedReviewResponseSchema,
          error: [
            environmentUnavailable,
            ...worktreeFailures,
            ...gitReadFailures,
            httpFailure(IncompleteDiffReadError, 'UnprocessableEntity'),
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
          error: [...worktreeFailures],
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
          error: [...worktreeFailures],
        },
      ),
      HttpApiEndpoint.delete(
        'removeReviewedLayer',
        '/api/worktrees/:worktreeId/reviewed-layers',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          query: removeReviewedLayerQuerySchema.fields,
          success: removeReviewedLayerResponseSchema,
          error: [...worktreeFailures],
        },
      ),
      HttpApiEndpoint.post(
        'replyToComment',
        '/api/worktrees/:worktreeId/comments/:threadId/replies',
        {
          disableCodecs: true,
          params: commentThreadParamsSchema,
          payload: replyToCommentRequestSchema,
          success: replyToCommentResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(CommentIdentityConflictError, 'Conflict'),
            httpFailure(CommentTargetNotFoundError, 'NotFound', {
              message: 'Comment target not found',
            }),
            httpFailure(CommentLimitExceededError, 'Conflict'),
          ],
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
      HttpApiEndpoint.put(
        'setReviewedLayer',
        '/api/worktrees/:worktreeId/reviewed-layers',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          payload: setReviewedLayerRequestSchema,
          success: setReviewedLayerResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(ReviewLayerNotFoundError, 'NotFound'),
            httpFailure(ReviewedMarkConflictError, 'Conflict'),
          ],
        },
      ),
      HttpApiEndpoint.put(
        'updateCommentThread',
        '/api/worktrees/:worktreeId/comments/:threadId/resolution',
        {
          disableCodecs: true,
          params: commentThreadParamsSchema,
          payload: updateCommentThreadRequestSchema,
          success: updateCommentThreadResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(CommentTargetNotFoundError, 'NotFound', {
              message: 'Comment target not found',
            }),
          ],
        },
      ),
    )
    .middleware(PairedRequest),
) {}
