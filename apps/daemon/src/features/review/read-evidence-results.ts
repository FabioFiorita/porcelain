import type { ReviewDoc } from '../../review/doc-set'
import type { ReviewEvidenceStore } from './review-evidence-capabilities'

/**
 * The Results sub-tab: `evidence/results/` read as a document set, the same primitive
 * as Intent. HTML arrives self-contained (siblings inlined by the store's reader) so
 * the renderer keeps it on the `sandbox="" srcdoc` path — never a `src` URL, which
 * would drop the parent CSP that backstops agent-authored HTML.
 */
export function createReadEvidenceResults(deps: { store: ReviewEvidenceStore }) {
  return ({ projectPath }: { projectPath: string }): Promise<ReviewDoc[]> =>
    deps.store.readResults(projectPath)
}
