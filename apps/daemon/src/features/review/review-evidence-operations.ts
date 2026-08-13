import { createClearEvidence } from './clear-evidence'
import { createFsReviewEvidenceStore } from './fs-review-evidence-store'
import { createReadEvidenceAsset } from './read-evidence-asset'
import { createReadEvidenceDoc } from './read-evidence-doc'
import { createReadEvidencePack } from './read-evidence-pack'
import type { ReviewEvidenceStore } from './review-evidence-capabilities'

export type ReviewEvidenceOperations = {
  readEvidencePack: ReturnType<typeof createReadEvidencePack>
  readEvidenceDoc: ReturnType<typeof createReadEvidenceDoc>
  readEvidenceAsset: ReturnType<typeof createReadEvidenceAsset>
  clearEvidence: ReturnType<typeof createClearEvidence>
}

/**
 * The Review Evidence family. One store owns the pack directory, so the aggregate's
 * descriptors, the document bodies, the image bytes, and the clear all agree about
 * what is on disk. No operation calls another.
 */
export function createReviewEvidenceOperations(options: {
  store?: ReviewEvidenceStore
}): ReviewEvidenceOperations {
  const store = options.store ?? createFsReviewEvidenceStore()

  return Object.freeze({
    readEvidencePack: createReadEvidencePack({ store }),
    readEvidenceDoc: createReadEvidenceDoc({ store }),
    readEvidenceAsset: createReadEvidenceAsset({ store }),
    clearEvidence: createClearEvidence({ store }),
  })
}
