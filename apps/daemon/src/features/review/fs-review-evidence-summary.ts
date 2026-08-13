import { createFsReviewEvidenceStore } from './fs-review-evidence-store'
import type { ReviewEvidence } from './review-reading-capabilities'

/**
 * The Evidence chapter's descriptor for the reading surface, over the same pack store
 * the Evidence procedures use. Deliberately the metadata only: the agent-authored
 * HTML body is fetched separately and stays on the sandboxed `srcdoc` path. `medium`
 * is still emitted because installed mobile clients parse it as required.
 */
export function createFsReviewEvidenceSummary(): ReviewEvidence {
  const store = createFsReviewEvidenceStore()
  return Object.freeze({
    readSummary: async (repoPath: string) => {
      const pack = await store.readPack(repoPath)
      if (!pack) return null
      return {
        title: pack.title,
        updatedAt: pack.updatedAt,
        checks: pack.checks,
        medium: 'html' as const,
      }
    },
  })
}
