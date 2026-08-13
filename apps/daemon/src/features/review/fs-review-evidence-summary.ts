import { createFsReviewEvidenceStore } from './fs-review-evidence-store'
import type { ReviewEvidence } from './review-reading-capabilities'

/**
 * The Evidence chapter's descriptor for the reading surface, over the same pack store
 * the Evidence procedures use. Deliberately the metadata only: the agent-authored
 * HTML body is fetched separately and stays on the sandboxed `srcdoc` path.
 */
export function createFsReviewEvidenceSummary(): ReviewEvidence {
  const store = createFsReviewEvidenceStore()
  return Object.freeze({
    readSummary: async (repoPath: string) => {
      const pack = await store.readPack(repoPath)
      if (!pack) return null
      return { title: pack.title, updatedAt: pack.updatedAt, checks: pack.checks }
    },
  })
}
