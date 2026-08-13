import { z } from 'zod'
import type { ProcedureContract } from '../procedure-contract'
import {
  targetActiveReviewOutputSchema,
  targetAddReviewCommentInputSchema,
  targetArchivedReviewIdInputSchema,
  targetArchivedReviewSchema,
  targetClearResolvedReviewCommentsInputSchema,
  targetDeleteReviewCommentInputSchema,
  targetEditReviewCommentInputSchema,
  targetEvidenceAssetBodySchema,
  targetExploreReadingInputSchema,
  targetPublishCostSchema,
  targetPublishResultSchema,
  targetRepoPathInputSchema,
  targetResolveReviewCommentInputSchema,
  targetReviewCommentSchema,
  targetReviewDocSchema,
  targetReviewEvidenceAssetInputSchema,
  targetReviewEvidenceDocInputSchema,
  targetReviewEvidenceOutputSchema,
  targetReviewInboxRowSchema,
  targetReviewIntentOutputSchema,
  targetReviewReadingOutputSchema,
  targetReviewReadingSchema,
  targetSetReviewedInputSchema,
  targetVoidOutputSchema,
} from './review.target-contract'

/**
 * The inactive target-v1 Review catalog (REV-001): 23 procedures — 12 queries, 11 mutations.
 *
 * It is deliberately not composed into `procedure-catalog.ts` and not re-exported from
 * `./index.ts`, so the live 113-name wire is untouched and no runtime caller can select
 * between two vocabularies. REV-009 activates these names and deletes this file with
 * `review.target-contract.ts` in the same cutover commit.
 *
 * Error lists are copied from each entry's active twin: only the six comment procedures
 * declare public codes. New codes belong to the units that land the failing operations.
 */
const reviewTargetProcedureDefinitions = {
  reviewInbox: {
    kind: 'query',
    input: targetRepoPathInputSchema,
    output: targetReviewInboxRowSchema.array(),
    errors: [],
  },
  reviewedPaths: {
    kind: 'query',
    input: targetRepoPathInputSchema,
    output: z.array(z.string()),
    errors: [],
  },
  activeReview: {
    kind: 'query',
    input: targetRepoPathInputSchema,
    output: targetActiveReviewOutputSchema,
    errors: [],
  },
  reviewReading: {
    kind: 'query',
    input: targetRepoPathInputSchema,
    output: targetReviewReadingOutputSchema,
    errors: [],
  },
  exploreReading: {
    kind: 'query',
    input: targetExploreReadingInputSchema,
    output: targetReviewReadingSchema,
    errors: [],
  },
  reviewIntent: {
    kind: 'query',
    input: targetRepoPathInputSchema,
    output: targetReviewIntentOutputSchema,
    errors: [],
  },
  reviewEvidence: {
    kind: 'query',
    input: targetRepoPathInputSchema,
    output: targetReviewEvidenceOutputSchema,
    errors: [],
  },
  reviewEvidenceDoc: {
    kind: 'query',
    input: targetReviewEvidenceDocInputSchema,
    output: targetReviewDocSchema.nullable(),
    errors: [],
  },
  reviewEvidenceAsset: {
    kind: 'query',
    input: targetReviewEvidenceAssetInputSchema,
    output: targetEvidenceAssetBodySchema.nullable(),
    errors: [],
  },
  publishCost: {
    kind: 'query',
    input: targetRepoPathInputSchema,
    output: targetPublishCostSchema,
    errors: [],
  },
  archivedReviews: {
    kind: 'query',
    input: targetRepoPathInputSchema,
    output: targetArchivedReviewSchema.array(),
    errors: [],
  },
  reviewComments: {
    kind: 'query',
    input: targetRepoPathInputSchema,
    output: targetReviewCommentSchema.array(),
    errors: ['review.unavailable'],
  },
  setReviewed: {
    kind: 'mutation',
    input: targetSetReviewedInputSchema,
    output: targetVoidOutputSchema,
    errors: [],
  },
  archiveReview: {
    kind: 'mutation',
    input: targetRepoPathInputSchema,
    output: targetVoidOutputSchema,
    errors: [],
  },
  clearEvidence: {
    kind: 'mutation',
    input: targetRepoPathInputSchema,
    output: targetVoidOutputSchema,
    errors: [],
  },
  publishReview: {
    kind: 'mutation',
    input: targetRepoPathInputSchema,
    output: targetPublishResultSchema.nullable(),
    errors: [],
  },
  restoreArchivedReview: {
    kind: 'mutation',
    input: targetArchivedReviewIdInputSchema,
    output: targetVoidOutputSchema,
    errors: [],
  },
  deleteArchivedReview: {
    kind: 'mutation',
    input: targetArchivedReviewIdInputSchema,
    output: targetVoidOutputSchema,
    errors: [],
  },
  addReviewComment: {
    kind: 'mutation',
    input: targetAddReviewCommentInputSchema,
    output: targetReviewCommentSchema,
    errors: ['review.unavailable', 'request.invalid'],
  },
  editReviewComment: {
    kind: 'mutation',
    input: targetEditReviewCommentInputSchema,
    output: targetVoidOutputSchema,
    errors: ['review.unavailable', 'review.comment-not-found'],
  },
  deleteReviewComment: {
    kind: 'mutation',
    input: targetDeleteReviewCommentInputSchema,
    output: targetVoidOutputSchema,
    errors: ['review.unavailable', 'review.comment-not-found'],
  },
  clearResolvedReviewComments: {
    kind: 'mutation',
    input: targetClearResolvedReviewCommentsInputSchema,
    output: targetVoidOutputSchema,
    errors: ['review.unavailable'],
  },
  resolveReviewComment: {
    kind: 'mutation',
    input: targetResolveReviewCommentInputSchema,
    output: targetVoidOutputSchema,
    errors: ['review.unavailable', 'review.comment-not-found'],
  },
} as const

export type ReviewTargetProcedureName = keyof typeof reviewTargetProcedureDefinitions

export const reviewTargetProcedures = reviewTargetProcedureDefinitions satisfies Record<
  ReviewTargetProcedureName,
  ProcedureContract
>

/**
 * The typed staleness fact for the single existing `review.changed` notification kind: exactly
 * the target queries a change under a project's active review makes stale.
 *
 * `reviewInbox` (a cross-worktree git scan) and `exploreReading` (independent of the active
 * review) are excluded. This adds no notification kind and no notification field.
 */
export const REVIEW_TARGET_STALE_ON_REVIEW_CHANGED: readonly ReviewTargetProcedureName[] = [
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
]
