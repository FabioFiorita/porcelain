import { z } from 'zod'
import type { ProcedureContract } from '../procedure-contract'
import {
  activeReviewOutputSchema,
  addReviewCommentInputSchema,
  archivedReviewIdInputSchema,
  archivedReviewSchema,
  clearResolvedReviewCommentsInputSchema,
  deleteReviewCommentInputSchema,
  editReviewCommentInputSchema,
  evidenceAssetBodySchema,
  exploreReadingInputSchema,
  publishCostSchema,
  publishResultSchema,
  repoPathInputSchema,
  resolveReviewCommentInputSchema,
  reviewCommentSchema,
  reviewDocSchema,
  reviewEvidenceAssetInputSchema,
  reviewEvidenceDocInputSchema,
  reviewEvidenceOutputSchema,
  reviewInboxRowSchema,
  reviewIntentOutputSchema,
  reviewReadingOutputSchema,
  reviewReadingSchema,
  setReviewedInputSchema,
  voidOutputSchema,
} from './review.contract'

/**
 * The canonical Review catalog (REV-001, activated by REV-009): 23 procedures — 12 queries,
 * 11 mutations. It is the Review record of the 113-name `procedure-catalog.ts`.
 *
 * Only the six comment procedures declare public codes: transport authentication, malformed
 * input, and unexpected defects are boundary system errors that no procedure repeats
 * (ERR-001). Evidence unavailability is expressed in the output type, not an error code.
 */
const reviewProcedureDefinitions = {
  reviewInbox: {
    kind: 'query',
    input: repoPathInputSchema,
    output: reviewInboxRowSchema.array(),
    errors: [],
  },
  reviewedPaths: {
    kind: 'query',
    input: repoPathInputSchema,
    output: z.array(z.string()),
    errors: [],
  },
  activeReview: {
    kind: 'query',
    input: repoPathInputSchema,
    output: activeReviewOutputSchema,
    errors: [],
  },
  reviewReading: {
    kind: 'query',
    input: repoPathInputSchema,
    output: reviewReadingOutputSchema,
    errors: [],
  },
  exploreReading: {
    kind: 'query',
    input: exploreReadingInputSchema,
    output: reviewReadingSchema,
    errors: [],
  },
  reviewIntent: {
    kind: 'query',
    input: repoPathInputSchema,
    output: reviewIntentOutputSchema,
    errors: [],
  },
  reviewEvidence: {
    kind: 'query',
    input: repoPathInputSchema,
    output: reviewEvidenceOutputSchema,
    errors: [],
  },
  reviewEvidenceDoc: {
    kind: 'query',
    input: reviewEvidenceDocInputSchema,
    output: reviewDocSchema.nullable(),
    errors: [],
  },
  reviewEvidenceAsset: {
    kind: 'query',
    input: reviewEvidenceAssetInputSchema,
    output: evidenceAssetBodySchema.nullable(),
    errors: [],
  },
  publishCost: {
    kind: 'query',
    input: repoPathInputSchema,
    output: publishCostSchema,
    errors: [],
  },
  archivedReviews: {
    kind: 'query',
    input: repoPathInputSchema,
    output: archivedReviewSchema.array(),
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
  archiveReview: {
    kind: 'mutation',
    input: repoPathInputSchema,
    output: voidOutputSchema,
    errors: [],
  },
  clearEvidence: {
    kind: 'mutation',
    input: repoPathInputSchema,
    output: voidOutputSchema,
    errors: [],
  },
  publishReview: {
    kind: 'mutation',
    input: repoPathInputSchema,
    output: publishResultSchema.nullable(),
    errors: [],
  },
  restoreArchivedReview: {
    kind: 'mutation',
    input: archivedReviewIdInputSchema,
    output: voidOutputSchema,
    errors: [],
  },
  deleteArchivedReview: {
    kind: 'mutation',
    input: archivedReviewIdInputSchema,
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
 * The typed staleness fact for the single existing `review.changed` notification kind: exactly
 * the queries a change under a project's active review makes stale.
 *
 * `reviewInbox` (a cross-worktree git scan) and `exploreReading` (independent of the active
 * review) are excluded. This adds no notification kind and no notification field.
 */
export const REVIEW_STALE_ON_REVIEW_CHANGED = [
  'activeReview',
  'reviewReading',
  'reviewIntent',
  'reviewEvidence',
  'reviewEvidenceDoc',
  'reviewEvidenceAsset',
  'reviewedPaths',
  'reviewComments',
  'publishCost',
  'archivedReviews',
] as const satisfies readonly ReviewProcedureName[]

/** One of the ten queries a `review.changed` notification makes stale. */
export type ReviewStaleProcedureName = (typeof REVIEW_STALE_ON_REVIEW_CHANGED)[number]
