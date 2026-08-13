import type { ReviewEvidenceStore } from './review-evidence-capabilities'

/**
 * The app's one write into the evidence pack: delete the directory. An absent pack is
 * success; anything else is a real failure the caller hears about rather than a
 * silent no-op clear.
 */
export function createClearEvidence(deps: { store: ReviewEvidenceStore }) {
  return ({ projectPath }: { projectPath: string }): Promise<void> => deps.store.clear(projectPath)
}
