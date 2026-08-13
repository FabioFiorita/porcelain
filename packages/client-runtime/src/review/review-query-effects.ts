import { type ReviewQuery, reviewProjectKey } from './review-queries'

/**
 * The broad freshness consequences Review declares when it cannot name the affected
 * dimension (REV-006). A change to the active review cannot say which evidence documents
 * or images moved, and `reviewEvidenceDoc` / `reviewEvidenceAsset` are the per-file Review
 * reads. A family is never a cache key — only an effect (the `git-query-effects.ts` rule).
 */
type ReviewFamilyEffect = {
  readonly domain: 'review'
  readonly name: 'evidence-asset-family' | 'evidence-doc-family'
  readonly projectPath: string
}

/** Exact Review identities plus the single explicit family used by freshness consequences. */
export type ReviewQueryEffect = ReviewQuery | ReviewFamilyEffect

/** Semantic project family for every per-file `reviewEvidenceAsset` wire query. */
export function reviewEvidenceAssetQueryFamily(projectPath: string): ReviewFamilyEffect {
  return {
    domain: 'review',
    name: 'evidence-asset-family',
    projectPath: reviewProjectKey(projectPath),
  }
}

/** Semantic project family for every per-file `reviewEvidenceDoc` wire query. */
export function reviewEvidenceDocQueryFamily(projectPath: string): ReviewFamilyEffect {
  return {
    domain: 'review',
    name: 'evidence-doc-family',
    projectPath: reviewProjectKey(projectPath),
  }
}

/** Match one typed exact/family effect against one exact cached Review identity. */
export function reviewQueryEffectMatchesQuery(
  query: ReviewQuery,
  effect: ReviewQueryEffect,
): boolean {
  if (query.domain !== effect.domain) return false
  if (query.projectPath !== effect.projectPath) return false
  if (effect.name === 'evidence-asset-family') return query.name === 'evidence-asset'
  if (effect.name === 'evidence-doc-family') return query.name === 'evidence-doc'
  return reviewQueryEffectKey(query) === reviewQueryEffectKey(effect)
}

function reviewQueryEffectKey(effect: ReviewQueryEffect): string {
  return JSON.stringify(effect)
}

/** Deduplicate effect declarations while preserving their first-seen order. */
export function dedupeReviewQueryEffects(
  effects: readonly ReviewQueryEffect[],
): readonly ReviewQueryEffect[] {
  const seen = new Set<string>()
  const result: ReviewQueryEffect[] = []
  for (const effect of effects) {
    const key = reviewQueryEffectKey(effect)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(effect)
  }
  return result
}
