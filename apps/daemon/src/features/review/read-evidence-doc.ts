import type { ReviewDoc } from '../../review/doc-set'
import type { ReviewEvidenceStore } from './review-evidence-capabilities'

/**
 * One Results document by descriptor `file`, or `null` when the set does not hold it
 * (missing, unrenderable, uncontained, or over a cap).
 *
 * The whole set is read to answer for one document on purpose: manifest order, the
 * default and de-duplicated labels, the inlined siblings, and the per-set byte budget
 * are all properties of the SET. Selecting a single file outside it would render a
 * document the Results tab would not — and the set is capped at twelve documents and
 * eight megabytes, so the read is bounded.
 */
export function createReadEvidenceDoc(deps: { store: ReviewEvidenceStore }) {
  return async ({
    projectPath,
    file,
  }: {
    projectPath: string
    file: string
  }): Promise<ReviewDoc | null> =>
    (await deps.store.readResults(projectPath)).find((doc) => doc.file === file) ?? null
}
