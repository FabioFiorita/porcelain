import type { EvidenceAsset } from '../../review/evidence-assets-list'
import type { ReviewEvidenceStore } from './review-evidence-capabilities'

/**
 * The Assets sub-tab: `evidence/assets/` listed as a gallery. Metadata only — one
 * tile's bytes arrive from `readEvidenceAsset`, on demand. The list is the pack's own
 * gallery, so the header count and the tiles can never disagree.
 */
export function createListEvidenceAssets(deps: { store: ReviewEvidenceStore }) {
  return async ({ projectPath }: { projectPath: string }): Promise<EvidenceAsset[]> =>
    (await deps.store.readPack(projectPath))?.assets ?? []
}
