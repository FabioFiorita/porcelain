import { z } from 'zod'
import type { ProcedureContract } from '../procedure-contract'
import {
  addReviewCommentInputSchema,
  clearResolvedReviewCommentsInputSchema,
  deleteReviewCommentInputSchema,
  editReviewCommentInputSchema,
  repoPathInputSchema,
  resolveReviewCommentInputSchema,
  reviewCommentSchema,
  setReviewedInputSchema,
  voidOutputSchema,
} from './review.contract'

/**
 * The canonical Review catalog: Canvas identity marks and comments.
 *
 * Only comment procedures declare public codes: transport authentication, malformed
 * input, and unexpected defects are boundary system errors that no procedure repeats
 * (ERR-001). Evidence unavailability is expressed in the output type, not an error code.
 */
const reviewProcedureDefinitions = {
  reviewedPaths: {
    kind: 'query',
    input: repoPathInputSchema,
    output: z.array(z.string()),
    errors: [],
  },
  reviewComments: {
    kind: 'query',
    input: repoPathInputSchema,
    output: reviewCommentSchema.array(),
    errors: ['review.unavailable'],
  },
  setReviewed: {
    kind: 'mutation',
    input: setReviewedInputSchema,
    output: voidOutputSchema,
    errors: [],
  },
  addReviewComment: {
    kind: 'mutation',
    input: addReviewCommentInputSchema,
    output: reviewCommentSchema,
    errors: ['review.unavailable', 'request.invalid'],
  },
  editReviewComment: {
    kind: 'mutation',
    input: editReviewCommentInputSchema,
    output: voidOutputSchema,
    errors: ['review.unavailable', 'review.comment-not-found'],
  },
  deleteReviewComment: {
    kind: 'mutation',
    input: deleteReviewCommentInputSchema,
    output: voidOutputSchema,
    errors: ['review.unavailable', 'review.comment-not-found'],
  },
  clearResolvedReviewComments: {
    kind: 'mutation',
    input: clearResolvedReviewCommentsInputSchema,
    output: voidOutputSchema,
    errors: ['review.unavailable'],
  },
  resolveReviewComment: {
    kind: 'mutation',
    input: resolveReviewCommentInputSchema,
    output: voidOutputSchema,
    errors: ['review.unavailable', 'review.comment-not-found'],
  },
} as const

export type ReviewProcedureName = keyof typeof reviewProcedureDefinitions

export const reviewProcedures = reviewProcedureDefinitions satisfies Record<
  ReviewProcedureName,
  ProcedureContract
>

/**
 * Review comments and reviewed marks are invalidated by their own session changes. The old
 * repo-local reading/Evidence query family was retired with active Review lifecycle removal.
 */
export const REVIEW_STALE_ON_REVIEW_CHANGED = [
  'reviewedPaths',
  'reviewComments',
] as const satisfies readonly ReviewProcedureName[]

/** One of the two remaining Review identities a `review.changed` notification makes stale. */
export type ReviewStaleProcedureName = (typeof REVIEW_STALE_ON_REVIEW_CHANGED)[number]
