import { defineEndpoint } from '../shared/endpoint.ts';
import { worktreeParamsSchema } from '../shared/worktree-params.ts';
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
  readReviewSummaryNotFoundResponseSchema,
  readReviewSummaryParamsSchema,
  readReviewSummaryQuerySchema,
  readReviewSummaryResponseSchema,
} from './review-summary.ts';
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

export const createCommentThreadEndpoint = defineEndpoint({
  method: 'POST',
  path: '/worktrees/:worktreeId/comments',
  schema: {
    params: worktreeParamsSchema,
    body: createCommentThreadRequestSchema,
    response: { 200: createCommentThreadResponseSchema },
  },
  errors: {},
});

export const deleteCommentMessageEndpoint = defineEndpoint({
  method: 'DELETE',
  path: '/worktrees/:worktreeId/comments/:threadId/messages',
  schema: {
    params: commentThreadParamsSchema,
    querystring: deleteCommentMessageQuerySchema,
    response: {
      200: deleteCommentMessageResponseSchema,
    },
  },
  errors: {},
});

export const deleteResolvedCommentsEndpoint = defineEndpoint({
  method: 'POST',
  path: '/worktrees/:worktreeId/comments/resolved/deletion',
  schema: {
    params: worktreeParamsSchema,
    body: deleteResolvedCommentsRequestSchema,
    response: {
      200: deleteResolvedCommentsResponseSchema,
    },
  },
  errors: {},
});

export const editCommentMessageEndpoint = defineEndpoint({
  method: 'PATCH',
  path: '/worktrees/:worktreeId/comments/:threadId/messages',
  schema: {
    params: commentThreadParamsSchema,
    body: editCommentMessageRequestSchema,
    response: { 200: editCommentMessageResponseSchema },
  },
  errors: {},
});

export const listCommentThreadsEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/comments',
  schema: {
    params: worktreeParamsSchema,
    response: { 200: listCommentThreadsResponseSchema },
  },
  errors: {},
});

export const listReviewedFilesEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/reviewed',
  schema: {
    params: worktreeParamsSchema,
    querystring: listReviewedFilesQuerySchema,
    response: { 200: listReviewedFilesResponseSchema },
  },
  errors: {},
});

export const listReviewedLayersEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/reviewed-layers',
  schema: {
    params: worktreeParamsSchema,
    response: { 200: listReviewedLayersResponseSchema },
  },
  errors: { worktree_changed: 409 },
});

export const markCommentsSeenEndpoint = defineEndpoint({
  method: 'POST',
  path: '/worktrees/:worktreeId/comments/seen',
  schema: {
    params: worktreeParamsSchema,
    body: markCommentsSeenRequestSchema,
    response: { 200: markCommentsSeenResponseSchema },
  },
  errors: {},
});

export const publishReviewEndpoint = defineEndpoint({
  method: 'PUT',
  path: '/worktrees/:worktreeId/review',
  schema: {
    params: worktreeParamsSchema,
    body: publishReviewRequestSchema,
    response: { 200: publishReviewResponseSchema },
  },
  errors: { worktree_changed: 409 },
});

export const readProofFileEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/review/proof',
  schema: {
    params: worktreeParamsSchema,
    querystring: readProofFileQuerySchema,
    response: { 200: readProofFileResponseSchema },
  },
  errors: {},
});

export const readPublishedReviewEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/review',
  schema: {
    params: worktreeParamsSchema,
    response: { 200: readPublishedReviewResponseSchema },
  },
  errors: { worktree_changed: 409 },
});

export const readReviewSummaryPageEndpoint = defineEndpoint({
  method: 'GET',
  path: '/review-summaries/:token',
  prefix: '',
  format: 'text',
  errorResponses: false,
  schema: {
    params: readReviewSummaryParamsSchema,
    querystring: readReviewSummaryQuerySchema,
    response: {
      200: readReviewSummaryResponseSchema,
      404: readReviewSummaryNotFoundResponseSchema,
    },
  },
  errors: {},
});

export const removeReviewedFileEndpoint = defineEndpoint({
  method: 'DELETE',
  path: '/worktrees/:worktreeId/reviewed',
  schema: {
    params: worktreeParamsSchema,
    querystring: removeReviewedFileQuerySchema,
    response: { 200: removeReviewedFileResponseSchema },
  },
  errors: {},
});

export const removeReviewedFilesEndpoint = defineEndpoint({
  method: 'DELETE',
  path: '/worktrees/:worktreeId/reviewed-bulk',
  schema: {
    params: worktreeParamsSchema,
    body: removeReviewedFilesRequestSchema,
    response: { 200: removeReviewedFilesResponseSchema },
  },
  errors: {},
});

export const removeReviewedLayerEndpoint = defineEndpoint({
  method: 'DELETE',
  path: '/worktrees/:worktreeId/reviewed-layers',
  schema: {
    params: worktreeParamsSchema,
    querystring: removeReviewedLayerQuerySchema,
    response: { 200: removeReviewedLayerResponseSchema },
  },
  errors: {},
});

export const replyToCommentEndpoint = defineEndpoint({
  method: 'POST',
  path: '/worktrees/:worktreeId/comments/:threadId/replies',
  schema: {
    params: commentThreadParamsSchema,
    body: replyToCommentRequestSchema,
    response: { 200: replyToCommentResponseSchema },
  },
  errors: {},
});

export const setReviewedFileEndpoint = defineEndpoint({
  method: 'PUT',
  path: '/worktrees/:worktreeId/reviewed',
  schema: {
    params: worktreeParamsSchema,
    body: setReviewedFileRequestSchema,
    response: { 200: setReviewedFileResponseSchema },
  },
  errors: { worktree_changed: 409 },
});

export const setReviewedFilesEndpoint = defineEndpoint({
  method: 'PUT',
  path: '/worktrees/:worktreeId/reviewed-bulk',
  schema: {
    params: worktreeParamsSchema,
    body: setReviewedFilesRequestSchema,
    response: { 200: setReviewedFilesResponseSchema },
  },
  errors: { worktree_changed: 409 },
});

export const setReviewedLayerEndpoint = defineEndpoint({
  method: 'PUT',
  path: '/worktrees/:worktreeId/reviewed-layers',
  schema: {
    params: worktreeParamsSchema,
    body: setReviewedLayerRequestSchema,
    response: { 200: setReviewedLayerResponseSchema },
  },
  errors: { worktree_changed: 409 },
});

export const updateCommentThreadEndpoint = defineEndpoint({
  method: 'PUT',
  path: '/worktrees/:worktreeId/comments/:threadId/resolution',
  schema: {
    params: commentThreadParamsSchema,
    body: updateCommentThreadRequestSchema,
    response: {
      200: updateCommentThreadResponseSchema,
    },
  },
  errors: {},
});
