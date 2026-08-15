import type { ReviewEvidencePack, ReviewEvidenceStore } from './review-evidence-capabilities'

/**
 * The one Evidence aggregate: checks, Results descriptors, and Assets descriptors.
 * `null` means "no pack" — never an empty pack, which reads as "cleared". No document
 * body and no media bytes are read here; both are fetched by descriptor, on demand.
 */
export function createReadEvidencePack(deps: { store: ReviewEvidenceStore }) {
  return ({ projectPath }: { projectPath: string }): Promise<ReviewEvidencePack | null> =>
    deps.store.readPack(projectPath)
}
