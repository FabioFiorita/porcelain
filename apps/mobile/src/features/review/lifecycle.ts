import type { FeatureReading } from '@/lib/daemon/procedures/review'

import { outlineFiles, reviewedFraction } from './review-outline'

export type ReviewLifecyclePhase = 'empty' | 'in_progress' | 'ready_to_close'

export function reviewLifecyclePhase(
  reading: FeatureReading | null,
  reviewedPaths: readonly string[],
): ReviewLifecyclePhase {
  if (reading === null) return 'empty'
  const hasEvidence = reading.evidence !== null
  const enoughReviewed =
    reviewedFraction(reading, reviewedPaths) >= 0.5 && outlineFiles(reading).length > 0
  return hasEvidence || enoughReviewed ? 'ready_to_close' : 'in_progress'
}

export function lifecycleBadgeLabel(phase: ReviewLifecyclePhase): string | null {
  if (phase === 'empty') return null
  return phase === 'ready_to_close' ? 'Ready to close' : 'In progress'
}

export function lifecycleDetail(
  reading: FeatureReading,
  phase: Exclude<ReviewLifecyclePhase, 'empty'>,
): string {
  if (phase === 'ready_to_close') {
    return reading.evidence === null
      ? 'Enough of the outline is reviewed. Ship via Changes when ready.'
      : 'Evidence is in. Mark files reviewed and ship via Changes when ready.'
  }
  if (outlineFiles(reading).length === 0 && reading.evidence === null) {
    return 'Intent is up. Execution and Evidence are still thin.'
  }
  if (outlineFiles(reading).length === 0)
    return 'Execution is still thin. Keep publishing the story.'
  if (reading.evidence === null)
    return 'Evidence is still thin. Keep publishing until the proof is real.'
  return 'Keep publishing until Intent, Execution, and Evidence tell the full story.'
}
