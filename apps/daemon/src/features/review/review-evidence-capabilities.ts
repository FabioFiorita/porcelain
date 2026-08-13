import type { EvidenceCheck } from '@shared/evidence-check'
import type { DocMedium, ReviewDoc } from '../../review/doc-set'
import type { EvidenceAsset, EvidenceAssetBody } from '../../review/evidence-assets-list'

/**
 * Review Evidence ports: one owner of `…/active-review/evidence/` — its meta, its
 * `results/` document set, its `assets/` gallery, its containment, its caps, and its
 * freshness. Document and asset shapes are reused from the readers that already own
 * their rules rather than restated here.
 *
 * No intention has an expected typed failure: a missing pack is `null`, an over-cap
 * document is dropped, an uncontained or oversized asset is `null` — so no error shape
 * is declared and an adapter failure propagates exactly as it does today.
 */

/** One renderable document in `results/`, described without its body or path. */
export type ReviewEvidenceDocDescriptor = {
  /** Plain file name — never a separator, never absolute. */
  file: string
  label: string
  medium: DocMedium
  bytes: number
}

/**
 * A pack as the Review feature sees it: checks, Results descriptors, Assets
 * descriptors, and one named legacy fact. No `medium`, no absolute directory.
 */
export type ReviewEvidencePack = {
  title: string
  updatedAt: string
  checks: EvidenceCheck[]
  results: ReviewEvidenceDocDescriptor[]
  assets: EvidenceAsset[]
  /**
   * A legacy root `index.html` is present. The ONLY root-index fact inside
   * `features/review/`; REV-009 deletes this member with `loopEvidenceHtml`.
   */
  legacyReport: boolean
}

/** The single owner of `…/active-review/evidence/`. No caller sees a host path. */
export type ReviewEvidenceStore = Readonly<{
  /** `null` when no pack exists: no meta file, no Results, no Assets, no report. */
  readPack(repoPath: string): Promise<ReviewEvidencePack | null>
  /** Results bodies, ordered and capped, for the Results sub-tab. */
  readResults(repoPath: string): Promise<ReviewDoc[]>
  /** One gallery image as a data URL; `null` when missing, uncontained, or over cap. */
  readAsset(repoPath: string, file: string): Promise<EvidenceAssetBody | null>
  /** Delete the pack directory; absent is success. */
  clear(repoPath: string): Promise<void>
}>
