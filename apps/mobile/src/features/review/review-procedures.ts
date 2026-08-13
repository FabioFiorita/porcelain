import { reviewProcedures } from '@porcelain/contracts/review'

import { namedContractMutation, namedContractQuery } from '@/lib/daemon/procedure'

/**
 * The twelve Review wire procedures this client actually calls, bound to the canonical
 * contracts (`features/git/workspace/git-queries.ts` idiom). No schema is declared here:
 * the name literal is the wire, and the shape comes from `@porcelain/contracts/review`.
 *
 * The names are LIVE-spelled — `featureReading` and `clearLoopEvidence` are wire history
 * from the Feature vocabulary, and renaming them is REV-009's job, not this file's.
 */

export const featureReadingProcedure = namedContractQuery(
  'featureReading',
  reviewProcedures.featureReading,
)

export const reviewIntentProcedure = namedContractQuery(
  'reviewIntent',
  reviewProcedures.reviewIntent,
)

export const reviewEvidenceDocsProcedure = namedContractQuery(
  'reviewEvidenceDocs',
  reviewProcedures.reviewEvidenceDocs,
)

export const reviewEvidenceAssetsProcedure = namedContractQuery(
  'reviewEvidenceAssets',
  reviewProcedures.reviewEvidenceAssets,
)

export const reviewEvidenceAssetProcedure = namedContractQuery(
  'reviewEvidenceAsset',
  reviewProcedures.reviewEvidenceAsset,
)

export const reviewPublishCostProcedure = namedContractQuery(
  'reviewPublishCost',
  reviewProcedures.reviewPublishCost,
)

export const archivedReviewsProcedure = namedContractQuery(
  'archivedReviews',
  reviewProcedures.archivedReviews,
)

export const clearFeatureReviewProcedure = namedContractMutation(
  'clearFeatureReview',
  reviewProcedures.clearFeatureReview,
)

export const publishReviewProcedure = namedContractMutation(
  'publishReview',
  reviewProcedures.publishReview,
)

export const restoreArchivedReviewProcedure = namedContractMutation(
  'restoreArchivedReview',
  reviewProcedures.restoreArchivedReview,
)

export const deleteArchivedReviewProcedure = namedContractMutation(
  'deleteArchivedReview',
  reviewProcedures.deleteArchivedReview,
)

export const clearLoopEvidenceProcedure = namedContractMutation(
  'clearLoopEvidence',
  reviewProcedures.clearLoopEvidence,
)
