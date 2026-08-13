import { reviewProcedures } from '@porcelain/contracts/review'

import { namedContractMutation, namedContractQuery } from '@/lib/daemon/procedure'

/**
 * The twelve Review wire procedures this client actually calls, bound to the canonical
 * contracts (`features/git/workspace/git-queries.ts` idiom). No schema is declared here:
 * the name literal is the wire, and the shape comes from `@porcelain/contracts/review`.
 *
 * This is the single file in the mobile client that spells a Review procedure name, so the
 * canonical vocabulary has exactly one binding point per procedure.
 */

export const reviewReadingProcedure = namedContractQuery(
  'reviewReading',
  reviewProcedures.reviewReading,
)

export const reviewIntentProcedure = namedContractQuery(
  'reviewIntent',
  reviewProcedures.reviewIntent,
)

/** The one Evidence aggregate: checks, Results descriptors and Asset descriptors. */
export const reviewEvidenceProcedure = namedContractQuery(
  'reviewEvidence',
  reviewProcedures.reviewEvidence,
)

/** One Results document's body, fetched by the descriptor's file name. */
export const reviewEvidenceDocProcedure = namedContractQuery(
  'reviewEvidenceDoc',
  reviewProcedures.reviewEvidenceDoc,
)

export const reviewEvidenceAssetProcedure = namedContractQuery(
  'reviewEvidenceAsset',
  reviewProcedures.reviewEvidenceAsset,
)

export const publishCostProcedure = namedContractQuery('publishCost', reviewProcedures.publishCost)

export const archivedReviewsProcedure = namedContractQuery(
  'archivedReviews',
  reviewProcedures.archivedReviews,
)

export const archiveReviewProcedure = namedContractMutation(
  'archiveReview',
  reviewProcedures.archiveReview,
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

export const clearEvidenceProcedure = namedContractMutation(
  'clearEvidence',
  reviewProcedures.clearEvidence,
)
