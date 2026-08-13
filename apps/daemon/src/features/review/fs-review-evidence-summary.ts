import { readEvidenceMeta } from '../../stores/evidence-store'
import type { ReviewEvidence } from './review-reading-capabilities'

/**
 * The Evidence chapter's descriptor for the reading surface. Deliberately the
 * metadata only: the agent-authored HTML body is fetched separately and stays on
 * the sandboxed `srcdoc` path. `medium` is still emitted because installed mobile
 * clients parse it as required.
 */
export function createFsReviewEvidenceSummary(): ReviewEvidence {
  return Object.freeze({
    readSummary: async (repoPath: string) => {
      const meta = await readEvidenceMeta(repoPath)
      if (!meta) return null
      return {
        title: meta.title,
        updatedAt: meta.updatedAt,
        checks: meta.checks,
        medium: meta.medium,
      }
    },
  })
}
