import type { EvidenceAssetBody } from '../../review/evidence-assets-list'
import type { ReviewEvidenceStore } from './review-evidence-capabilities'

/**
 * One gallery media asset as a data URL. The client-supplied name passes through unchanged
 * — the store validates it twice (name shape and resolved path) and rejects a symlink
 * before any read. Missing, uncontained, non-image, or over-cap is `null`, never an
 * error and never a body.
 */
export function createReadEvidenceAsset(deps: { store: ReviewEvidenceStore }) {
  return ({
    projectPath,
    file,
  }: {
    projectPath: string
    file: string
  }): Promise<EvidenceAssetBody | null> => deps.store.readAsset(projectPath, file)
}
