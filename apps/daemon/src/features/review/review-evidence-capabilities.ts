import type { EvidenceCheck } from '@shared/evidence-check'
import type { DocMedium, ReviewDoc } from '../../review/doc-set'
import type { EvidenceAssetBody } from '../../review/evidence-assets-list'

/**
 * Review Evidence ports: one owner of `…/active-review/evidence/` — its meta, its
 * `results/` document set, its `assets/` gallery, its containment, its caps, and its
 * freshness. Document and asset bodies are read by the modules that already own their
 * rules rather than restated here.
 *
 * No intention has an expected typed failure: a missing pack is `null`, a missing or
 * uncontained document or asset is `null` — so no error shape is declared and an
 * adapter failure propagates exactly as it does today.
 */

/**
 * Why a described file cannot be served as bytes. A descriptor still LISTS it, so the
 * pack says what is there instead of pretending it is smaller than it is.
 */
type EvidenceUnavailable = {
  state: 'unavailable'
  reason: 'too-large'
  maxBytes: number
}

/** One renderable document in `results/`, described without its body or path. */
export type ReviewEvidenceDocDescriptor = {
  /** Plain file name — never a separator, never absolute. */
  file: string
  label: string
  medium: DocMedium
  bytes: number
} & ({ state: 'available' } | EvidenceUnavailable)

/** One gallery image, described without its bytes. */
export type ReviewEvidenceAssetDescriptor = {
  file: string
  label: string
  kind: 'image'
  mime: string
  bytes: number
} & ({ state: 'available' } | EvidenceUnavailable)

/**
 * A pack as the Review feature sees it: checks, Results descriptors, and Assets
 * descriptors. No `medium`, no absolute directory, no root-report fact.
 */
export type ReviewEvidencePack = {
  title: string
  updatedAt: string
  checks: EvidenceCheck[]
  results: ReviewEvidenceDocDescriptor[]
  assets: ReviewEvidenceAssetDescriptor[]
}

/** The single owner of `…/active-review/evidence/`. No caller sees a host path. */
export type ReviewEvidenceStore = Readonly<{
  /** `null` when no pack exists: no meta file, no Results, no Assets. */
  readPack(repoPath: string): Promise<ReviewEvidencePack | null>
  /** Results bodies, ordered and capped, for the Results sub-tab. */
  readResults(repoPath: string): Promise<ReviewDoc[]>
  /** One gallery image as a data URL; `null` when missing, uncontained, or over cap. */
  readAsset(repoPath: string, file: string): Promise<EvidenceAssetBody | null>
  /** Delete the pack directory; absent is success. */
  clear(repoPath: string): Promise<void>
}>
