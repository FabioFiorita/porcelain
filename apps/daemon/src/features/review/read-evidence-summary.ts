import type { ReviewEvidencePack, ReviewEvidenceStore } from './review-evidence-capabilities'

/**
 * The evidence pack for the Evidence header and the Feature-list opener: checks,
 * Results descriptors, Assets descriptors, and the legacy-report fact. `null` means
 * "no pack" — never an empty pack, which reads as "cleared". No document body and no
 * image bytes are read here.
 */
export function createReadEvidenceSummary(deps: { store: ReviewEvidenceStore }) {
  return ({ projectPath }: { projectPath: string }): Promise<ReviewEvidencePack | null> =>
    deps.store.readPack(projectPath)
}
