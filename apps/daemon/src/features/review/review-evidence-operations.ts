import { createClearEvidence } from './clear-evidence'
import { createFsReviewEvidenceStore } from './fs-review-evidence-store'
import { createListEvidenceAssets } from './list-evidence-assets'
import { createReadEvidenceAsset } from './read-evidence-asset'
import { createReadEvidenceResults } from './read-evidence-results'
import { createReadEvidenceSummary } from './read-evidence-summary'
import type { ReviewEvidenceStore } from './review-evidence-capabilities'

export type ReviewEvidenceOperations = {
  readEvidenceSummary: ReturnType<typeof createReadEvidenceSummary>
  readEvidenceResults: ReturnType<typeof createReadEvidenceResults>
  listEvidenceAssets: ReturnType<typeof createListEvidenceAssets>
  readEvidenceAsset: ReturnType<typeof createReadEvidenceAsset>
  clearEvidence: ReturnType<typeof createClearEvidence>
}

/**
 * The Review Evidence family. One store owns the pack directory, so the header count,
 * the gallery, the document set, and the clear all agree about what is on disk. No
 * operation calls another.
 */
export function createReviewEvidenceOperations(options: {
  store?: ReviewEvidenceStore
}): ReviewEvidenceOperations {
  const store = options.store ?? createFsReviewEvidenceStore()

  return Object.freeze({
    readEvidenceSummary: createReadEvidenceSummary({ store }),
    readEvidenceResults: createReadEvidenceResults({ store }),
    listEvidenceAssets: createListEvidenceAssets({ store }),
    readEvidenceAsset: createReadEvidenceAsset({ store }),
    clearEvidence: createClearEvidence({ store }),
  })
}
