import { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api';
import {
  DraftCommentNotFoundError,
  DraftCommentPublishedError,
  PullRequestReviewFailedError,
  ReviewChangedError,
} from '@porcelain/reviews/errors';
import { porcelainApi } from '../shared/http-api.ts';
import { PairedRequest } from '../shared/http-caller.ts';
import { httpFailure } from '../shared/http-failure.ts';
import { gitReadFailures } from '../shared/git-read-failures.ts';
import { worktreeFailures } from '../shared/worktree-failures.ts';
import { worktreeParamsSchema } from '../shared/worktree-params.ts';
import {
  addCommentRequestSchema,
  commentParamsSchema,
  commentsResponseSchema,
  editCommentRequestSchema,
  ownerCommentsQuerySchema,
  publishReviewRequestSchema,
  publishReviewResponseSchema,
  reviewPreviewResponseSchema,
} from './comments.ts';

const readFailures = [...worktreeFailures, ...gitReadFailures] as const;
const notFound = httpFailure(DraftCommentNotFoundError, 'NotFound');
const writeFailures = [
  ...readFailures,
  notFound,
  httpFailure(DraftCommentPublishedError, 'Conflict'),
] as const;

export class CommentsApi extends porcelainApi.add(
  HttpApiGroup.make('comments')
    .add(
      HttpApiEndpoint.get(
        'listComments',
        '/api/worktrees/:worktreeId/comments',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          success: commentsResponseSchema,
          error: readFailures,
        },
      ),
      HttpApiEndpoint.post(
        'addComment',
        '/api/worktrees/:worktreeId/comments',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          payload: addCommentRequestSchema,
          success: commentsResponseSchema,
          error: writeFailures,
        },
      ),
      HttpApiEndpoint.patch(
        'editComment',
        '/api/worktrees/:worktreeId/comments/:commentId',
        {
          disableCodecs: true,
          params: commentParamsSchema,
          payload: editCommentRequestSchema,
          success: commentsResponseSchema,
          error: writeFailures,
        },
      ),
      HttpApiEndpoint.delete(
        'deleteComment',
        '/api/worktrees/:worktreeId/comments/:commentId',
        {
          disableCodecs: true,
          params: commentParamsSchema,
          success: commentsResponseSchema,
          error: writeFailures,
        },
      ),
      HttpApiEndpoint.get(
        'previewCommentReview',
        '/api/worktrees/:worktreeId/comments/review',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          success: reviewPreviewResponseSchema,
          error: readFailures,
        },
      ),
      HttpApiEndpoint.post(
        'publishCommentReview',
        '/api/worktrees/:worktreeId/comments/review',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          payload: publishReviewRequestSchema,
          success: publishReviewResponseSchema,
          error: [
            ...readFailures,
            httpFailure(ReviewChangedError, 'Conflict', {
              message: { fromError: true },
            }),
            httpFailure(PullRequestReviewFailedError, 'BadGateway', {
              message: { fromError: true },
            }),
          ],
        },
      ),
    )
    .middleware(PairedRequest),
) {}

export class OwnerCommentsApi extends porcelainApi.add(
  HttpApiGroup.make('ownerComments')
    .add(
      HttpApiEndpoint.get('readOwnerComments', '/worktree-comments', {
        disableCodecs: true,
        query: ownerCommentsQuerySchema.fields,
        success: commentsResponseSchema,
        error: readFailures,
      }),
    )
    .middleware(PairedRequest),
) {}
