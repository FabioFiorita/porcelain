import type { ReviewDoc } from '../../review/doc-set'
import type { ReviewIntent } from './review-reading-capabilities'

/**
 * Intent as a document set: `.porcelain/active-review/intent/` rendered as ordered
 * tabs — the first reading of the Review canvas. HTML arrives self-contained
 * (siblings inlined by the reader) so the renderer keeps it on the
 * `sandbox="" srcdoc` path — never a `src` URL, which would drop the parent CSP
 * that backstops agent-authored HTML.
 */
export function createReadReviewIntent(deps: { intent: ReviewIntent }) {
  return ({ projectPath }: { projectPath: string }): Promise<ReviewDoc[]> =>
    deps.intent.readDocs(projectPath)
}
