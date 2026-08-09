import type { ProcedureContract } from '../procedure-contract'
import type { ProcedureName } from '../procedures/names'
import {
  addReviewCommentInputSchema,
  archivedReviewsOutputSchema,
  clearResolvedReviewCommentsInputSchema,
  deleteArchivedReviewInputSchema,
  deleteReviewCommentInputSchema,
  editReviewCommentInputSchema,
  evidenceAssetBodySchema,
  evidenceMetaSchema,
  evidenceSchema,
  exploreFeatureInputSchema,
  featureReadingOutputSchema,
  featureViewSchema,
  markReviewedInputSchema,
  publishCostSchema,
  publishResultSchema,
  repoLayersOutputSchema,
  resolveReviewCommentInputSchema,
  restoreArchivedReviewInputSchema,
  reviewCommentSchema,
  reviewEvidenceAssetInputSchema,
  reviewEvidenceAssetsOutputSchema,
  reviewEvidenceDocsOutputSchema,
  reviewedPathsInputSchema,
  reviewedPathsOutputSchema,
  reviewIntentOutputSchema,
  reviewRepoPathInputSchema,
  setRepoLayersInputSchema,
  setReviewedInputSchema,
  unmarkReviewedInputSchema,
  voidOutputSchema,
  worktreeInboxInputSchema,
  worktreeInboxOutputSchema,
} from './review.contract'

const reviewProcedureDefinitions = {
  worktreeInbox: {
    kind: 'query',
    input: worktreeInboxInputSchema,
    output: worktreeInboxOutputSchema,
  },
  markReviewed: { kind: 'mutation', input: markReviewedInputSchema, output: voidOutputSchema },
  unmarkReviewed: {
    kind: 'mutation',
    input: unmarkReviewedInputSchema,
    output: voidOutputSchema,
  },
  reviewedPaths: {
    kind: 'query',
    input: reviewedPathsInputSchema,
    output: reviewedPathsOutputSchema,
  },
  setReviewed: { kind: 'mutation', input: setReviewedInputSchema, output: voidOutputSchema },
  featureView: { kind: 'query', input: reviewRepoPathInputSchema, output: featureViewSchema },
  featureReading: {
    kind: 'query',
    input: reviewRepoPathInputSchema,
    output: featureReadingOutputSchema,
  },
  clearFeatureReview: {
    kind: 'mutation',
    input: reviewRepoPathInputSchema,
    output: voidOutputSchema,
  },
  reviewIntent: {
    kind: 'query',
    input: reviewRepoPathInputSchema,
    output: reviewIntentOutputSchema,
  },
  reviewEvidenceDocs: {
    kind: 'query',
    input: reviewRepoPathInputSchema,
    output: reviewEvidenceDocsOutputSchema,
  },
  reviewEvidenceAssets: {
    kind: 'query',
    input: reviewRepoPathInputSchema,
    output: reviewEvidenceAssetsOutputSchema,
  },
  reviewEvidenceAsset: {
    kind: 'query',
    input: reviewEvidenceAssetInputSchema,
    output: evidenceAssetBodySchema.nullable(),
  },
  reviewPublishCost: {
    kind: 'query',
    input: reviewRepoPathInputSchema,
    output: publishCostSchema,
  },
  publishReview: {
    kind: 'mutation',
    input: reviewRepoPathInputSchema,
    output: publishResultSchema.nullable(),
  },
  archivedReviews: {
    kind: 'query',
    input: reviewRepoPathInputSchema,
    output: archivedReviewsOutputSchema,
  },
  restoreArchivedReview: {
    kind: 'mutation',
    input: restoreArchivedReviewInputSchema,
    output: voidOutputSchema,
  },
  deleteArchivedReview: {
    kind: 'mutation',
    input: deleteArchivedReviewInputSchema,
    output: voidOutputSchema,
  },
  loopEvidence: {
    kind: 'query',
    input: reviewRepoPathInputSchema,
    output: evidenceMetaSchema.nullable(),
  },
  loopEvidenceHtml: {
    kind: 'query',
    input: reviewRepoPathInputSchema,
    output: evidenceSchema.nullable(),
  },
  clearLoopEvidence: {
    kind: 'mutation',
    input: reviewRepoPathInputSchema,
    output: voidOutputSchema,
  },
  reviewComments: {
    kind: 'query',
    input: reviewRepoPathInputSchema,
    output: reviewCommentSchema.array(),
  },
  addReviewComment: {
    kind: 'mutation',
    input: addReviewCommentInputSchema,
    output: reviewCommentSchema,
  },
  editReviewComment: {
    kind: 'mutation',
    input: editReviewCommentInputSchema,
    output: voidOutputSchema,
  },
  deleteReviewComment: {
    kind: 'mutation',
    input: deleteReviewCommentInputSchema,
    output: voidOutputSchema,
  },
  clearResolvedReviewComments: {
    kind: 'mutation',
    input: clearResolvedReviewCommentsInputSchema,
    output: voidOutputSchema,
  },
  resolveReviewComment: {
    kind: 'mutation',
    input: resolveReviewCommentInputSchema,
    output: voidOutputSchema,
  },
  exploreFeature: {
    kind: 'query',
    input: exploreFeatureInputSchema,
    output: featureReadingOutputSchema,
  },
  repoLayers: {
    kind: 'query',
    input: reviewRepoPathInputSchema,
    output: repoLayersOutputSchema,
  },
  setRepoLayers: {
    kind: 'mutation',
    input: setRepoLayersInputSchema,
    output: voidOutputSchema,
  },
} as const

export type ReviewProcedureName = Extract<keyof typeof reviewProcedureDefinitions, ProcedureName>

export const reviewProcedures = reviewProcedureDefinitions satisfies Record<
  ReviewProcedureName,
  ProcedureContract
>
