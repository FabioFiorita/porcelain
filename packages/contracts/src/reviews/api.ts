import {
  archiveReviewRequestSchema,
  archiveReviewResponseSchema,
} from '@porcelain/reviews/models';
import { ReviewArchiveRefusedError } from '@porcelain/reviews/errors';
import {
  compareReviewQuerySchema,
  compareReviewResponseSchema,
  readReviewInterdiffQuerySchema,
  readReviewInterdiffResponseSchema,
} from './review-comparison.ts';
import {
  readPullRequestResponseSchema,
  listPullRequestsResponseSchema,
  githubAccountResultSchema,
  setGitHubAccountRequestSchema,
} from './pull-requests.ts';
import { ProjectNotFoundError } from '@porcelain/projects/errors';
import { Schema } from 'effect';
import { readBranchDiffsResponseSchema } from '../changes/branch-changes.ts';
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
  CommitNotFoundError,
  BranchBaseNotFoundError,
  UnbornBranchError,
  UnrelatedBranchError,
} from '@porcelain/changes/errors';
import {
  InvalidReviewComparisonError,
  ReviewNotFoundError,
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
  InvalidReviewPointerError,
  UnknownProofTargetError,
  ReviewPublishRefusedError,
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
  commentThreadTargetParamsSchema,
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
  reviewMarksResponseSchema,
  setReviewMarkRequestSchema,
  removeReviewMarkRequestSchema,
  reviewParamsSchema,
  projectReviewParamsSchema,
  readReviewDiffsRequestSchema,
  reviewRevisionParamsSchema,
  readReviewResponseSchema,
  listProjectReviewsResponseSchema,
  setReviewSeenRequestSchema,
  setReviewStateRequestSchema,
  reviewUpdatedResponseSchema,
  readReviewFileQuerySchema,
  readReviewFileResponseSchema,
  deleteReviewResponseSchema,
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
      HttpApiEndpoint.post('archiveReview', '/api/reviews/:reviewId/archive', {
        disableCodecs: true,
        params: reviewParamsSchema,
        payload: archiveReviewRequestSchema,
        success: archiveReviewResponseSchema,
        error: [
          httpFailure(ReviewNotFoundError, 'NotFound'),
          httpFailure(ProjectNotFoundError, 'NotFound'),
          httpFailure(ReviewArchiveRefusedError, 'Conflict', {
            message: { fromError: true },
          }),
        ],
      }),
      HttpApiEndpoint.get('compareReview', '/api/reviews/:reviewId/compare', {
        disableCodecs: true,
        params: reviewParamsSchema,
        query: compareReviewQuerySchema.fields,
        success: compareReviewResponseSchema,
        error: [
          httpFailure(ReviewNotFoundError, 'NotFound'),
          httpFailure(InvalidReviewComparisonError, 'BadRequest', {
            message: { fromError: true },
          }),
        ],
      }),
      HttpApiEndpoint.get(
        'readReviewInterdiff',
        '/api/reviews/:reviewId/interdiff',
        {
          disableCodecs: true,
          params: reviewParamsSchema,
          query: readReviewInterdiffQuerySchema.fields,
          success: readReviewInterdiffResponseSchema,
          error: [
            ...worktreeFailures,
            ...gitReadFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
            httpFailure(InvalidReviewComparisonError, 'BadRequest', {
              message: { fromError: true },
            }),
            httpFailure(CommitNotFoundError, 'NotFound'),
            httpFailure(IncompleteDiffReadError, 'UnprocessableEntity'),
          ],
        },
      ),
      HttpApiEndpoint.get(
        'readReviewPullRequest',
        '/api/reviews/:reviewId/pull-request',
        {
          disableCodecs: true,
          params: reviewParamsSchema,
          success: readPullRequestResponseSchema,
          error: [
            httpFailure(ReviewNotFoundError, 'NotFound'),
            httpFailure(ProjectNotFoundError, 'NotFound'),
          ],
        },
      ),
      HttpApiEndpoint.get(
        'listProjectPullRequests',
        '/api/projects/:projectId/pull-requests',
        {
          disableCodecs: true,
          params: projectReviewParamsSchema,
          success: listPullRequestsResponseSchema,
          error: [httpFailure(ProjectNotFoundError, 'NotFound')],
        },
      ),
      HttpApiEndpoint.get(
        'readProjectGitHubAccount',
        '/api/projects/:projectId/github-account',
        {
          disableCodecs: true,
          params: projectReviewParamsSchema,
          success: githubAccountResultSchema,
          error: [httpFailure(ProjectNotFoundError, 'NotFound')],
        },
      ),
      HttpApiEndpoint.put(
        'setProjectGitHubAccount',
        '/api/projects/:projectId/github-account',
        {
          disableCodecs: true,
          params: projectReviewParamsSchema,
          payload: setGitHubAccountRequestSchema,
          success: githubAccountResultSchema,
          error: [httpFailure(ProjectNotFoundError, 'NotFound')],
        },
      ),
    )
    .add(
      HttpApiEndpoint.delete(
        'deleteReviewCommentMessage',
        '/api/reviews/:reviewId/comments/:threadId/messages',
        {
          disableCodecs: true,
          params: Schema.Struct({
            ...reviewParamsSchema.fields,
            ...commentThreadTargetParamsSchema.fields,
          }),
          query: deleteCommentMessageQuerySchema.fields,
          success: deleteCommentMessageResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
            httpFailure(CommentTargetNotFoundError, 'NotFound', {
              message: 'Comment target not found',
            }),
            httpFailure(CommentAuthorMismatchError, 'Forbidden'),
          ],
        },
      ),
      HttpApiEndpoint.post(
        'deleteResolvedReviewComments',
        '/api/reviews/:reviewId/comments/resolved/deletion',
        {
          disableCodecs: true,
          params: reviewParamsSchema,
          payload: deleteResolvedCommentsRequestSchema,
          success: deleteResolvedCommentsResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
          ],
        },
      ),
      HttpApiEndpoint.patch(
        'editReviewCommentMessage',
        '/api/reviews/:reviewId/comments/:threadId/messages',
        {
          disableCodecs: true,
          params: Schema.Struct({
            ...reviewParamsSchema.fields,
            ...commentThreadTargetParamsSchema.fields,
          }),
          payload: editCommentMessageRequestSchema,
          success: editCommentMessageResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
            httpFailure(CommentTargetNotFoundError, 'NotFound', {
              message: 'Comment target not found',
            }),
            httpFailure(CommentAuthorMismatchError, 'Forbidden'),
            httpFailure(CommentLimitExceededError, 'Conflict'),
          ],
        },
      ),
      HttpApiEndpoint.get('listReviewMarks', '/api/reviews/:reviewId/marks', {
        disableCodecs: true,
        params: reviewParamsSchema,
        success: reviewMarksResponseSchema,
        error: [httpFailure(ReviewNotFoundError, 'NotFound')],
      }),
      HttpApiEndpoint.put('setReviewMark', '/api/reviews/:reviewId/marks', {
        disableCodecs: true,
        params: reviewParamsSchema,
        payload: setReviewMarkRequestSchema,
        success: reviewUpdatedResponseSchema,
        error: [
          httpFailure(ReviewNotFoundError, 'NotFound'),
          httpFailure(ReviewedMarkConflictError, 'Conflict'),
        ],
      }),
      HttpApiEndpoint.post(
        'removeReviewMark',
        '/api/reviews/:reviewId/marks/removal',
        {
          disableCodecs: true,
          params: reviewParamsSchema,
          payload: removeReviewMarkRequestSchema,
          success: reviewUpdatedResponseSchema,
          error: [httpFailure(ReviewNotFoundError, 'NotFound')],
        },
      ),
      HttpApiEndpoint.post(
        'createReviewCommentThread',
        '/api/reviews/:reviewId/comments',
        {
          disableCodecs: true,
          params: reviewParamsSchema,
          payload: createCommentThreadRequestSchema,
          success: createCommentThreadResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
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
      HttpApiEndpoint.get(
        'listReviewCommentThreads',
        '/api/reviews/:reviewId/comments',
        {
          disableCodecs: true,
          params: reviewParamsSchema,
          success: listCommentThreadsResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
          ],
        },
      ),
      HttpApiEndpoint.post(
        'replyToReviewComment',
        '/api/reviews/:reviewId/comments/:threadId/replies',
        {
          disableCodecs: true,
          params: Schema.Struct({
            ...reviewParamsSchema.fields,
            ...commentThreadTargetParamsSchema.fields,
          }),
          payload: replyToCommentRequestSchema,
          success: replyToCommentResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
            httpFailure(CommentIdentityConflictError, 'Conflict'),
            httpFailure(CommentTargetNotFoundError, 'NotFound', {
              message: 'Comment target not found',
            }),
            httpFailure(CommentLimitExceededError, 'Conflict'),
          ],
        },
      ),
      HttpApiEndpoint.put(
        'updateReviewCommentThread',
        '/api/reviews/:reviewId/comments/:threadId',
        {
          disableCodecs: true,
          params: Schema.Struct({
            ...reviewParamsSchema.fields,
            ...commentThreadTargetParamsSchema.fields,
          }),
          payload: updateCommentThreadRequestSchema,
          success: updateCommentThreadResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
            httpFailure(CommentTargetNotFoundError, 'NotFound', {
              message: 'Comment target not found',
            }),
          ],
        },
      ),
      HttpApiEndpoint.get('readReview', '/api/reviews/:reviewId', {
        disableCodecs: true,
        params: reviewParamsSchema,
        success: readReviewResponseSchema,
        error: [
          environmentUnavailable,
          ...worktreeFailures,
          httpFailure(ReviewNotFoundError, 'NotFound'),
        ],
      }),
      HttpApiEndpoint.get(
        'readReviewRevision',
        '/api/reviews/:reviewId/revisions/:revision',
        {
          disableCodecs: true,
          params: reviewRevisionParamsSchema,
          success: readReviewResponseSchema,
          error: [
            environmentUnavailable,
            ...worktreeFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
          ],
        },
      ),
      HttpApiEndpoint.get(
        'listProjectReviews',
        '/api/projects/:projectId/reviews',
        {
          disableCodecs: true,
          params: projectReviewParamsSchema,
          success: listProjectReviewsResponseSchema,
        },
      ),
      HttpApiEndpoint.put('setReviewSeen', '/api/reviews/:reviewId/seen', {
        disableCodecs: true,
        params: reviewParamsSchema,
        payload: setReviewSeenRequestSchema,
        success: reviewUpdatedResponseSchema,
        error: [httpFailure(ReviewNotFoundError, 'NotFound')],
      }),
      HttpApiEndpoint.patch('setReviewState', '/api/reviews/:reviewId', {
        disableCodecs: true,
        params: reviewParamsSchema,
        payload: setReviewStateRequestSchema,
        success: reviewUpdatedResponseSchema,
        error: [httpFailure(ReviewNotFoundError, 'NotFound')],
      }),
      HttpApiEndpoint.delete('deleteProjectReview', '/api/reviews/:reviewId', {
        disableCodecs: true,
        params: reviewParamsSchema,
        success: deleteReviewResponseSchema,
        error: [
          ...worktreeFailures,
          httpFailure(ReviewNotFoundError, 'NotFound'),
        ],
      }),
      HttpApiEndpoint.get(
        'readReviewProofFile',
        '/api/reviews/:reviewId/revisions/:revision/proof',
        {
          disableCodecs: true,
          params: reviewRevisionParamsSchema,
          query: readProofFileQuerySchema.fields,
          success: readProofFileResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(ProofFileNotFoundError, 'NotFound'),
          ],
        },
      ),
      HttpApiEndpoint.get(
        'readReviewFile',
        '/api/reviews/:reviewId/revisions/:revision/file',
        {
          disableCodecs: true,
          params: reviewRevisionParamsSchema,
          query: readReviewFileQuerySchema.fields,
          success: readReviewFileResponseSchema,
          error: [httpFailure(ReviewNotFoundError, 'NotFound')],
        },
      ),
      HttpApiEndpoint.post(
        'readReviewDiffs',
        '/api/reviews/:reviewId/revisions/:revision/diffs',
        {
          disableCodecs: true,
          params: reviewRevisionParamsSchema,
          payload: readReviewDiffsRequestSchema,
          success: readBranchDiffsResponseSchema,
          error: [
            ...worktreeFailures,
            ...gitReadFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
            httpFailure(CommitNotFoundError, 'NotFound'),
            httpFailure(IncompleteDiffReadError, 'UnprocessableEntity'),
          ],
        },
      ),
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
            httpFailure(ReviewNotFoundError, 'NotFound'),
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
            httpFailure(ReviewNotFoundError, 'NotFound'),
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
          error: [
            ...worktreeFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
          ],
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
            httpFailure(ReviewNotFoundError, 'NotFound'),
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
          error: [
            ...worktreeFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
          ],
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
          error: [
            ...worktreeFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
          ],
        },
      ),
      HttpApiEndpoint.get(
        'listReviewedLayers',
        '/api/worktrees/:worktreeId/reviewed-layers',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          success: listReviewedLayersResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
          ],
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
          error: [
            ...worktreeFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
          ],
        },
      ),
      HttpApiEndpoint.delete(
        'deleteReview',
        '/api/worktrees/:worktreeId/review',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          success: deleteReviewResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
          ],
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
            httpFailure(InvalidReviewPointerError, 'BadRequest', {
              message: { fromError: true },
            }),
            httpFailure(ReviewConflictError, 'Conflict'),
            httpFailure(ReviewPublishRefusedError, 'Conflict', {
              message: { fromError: true },
            }),
            httpFailure(CommitNotFoundError, 'NotFound'),
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
      HttpApiEndpoint.delete(
        'removeReviewedLayer',
        '/api/worktrees/:worktreeId/reviewed-layers',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          query: removeReviewedLayerQuerySchema.fields,
          success: removeReviewedLayerResponseSchema,
          error: [
            ...worktreeFailures,
            httpFailure(ReviewNotFoundError, 'NotFound'),
          ],
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
            httpFailure(ReviewNotFoundError, 'NotFound'),
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
            httpFailure(ReviewNotFoundError, 'NotFound'),
            httpFailure(CommentTargetNotFoundError, 'NotFound', {
              message: 'Comment target not found',
            }),
          ],
        },
      ),
    )
    .middleware(PairedRequest),
) {}
