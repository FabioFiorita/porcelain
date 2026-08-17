import type { ReviewQuery } from './review-queries'

export type ReviewQueryEffect = ReviewQuery

export function reviewQueryEffectMatchesQuery(
  query: ReviewQuery,
  effect: ReviewQueryEffect,
): boolean {
  return JSON.stringify(query) === JSON.stringify(effect)
}

export function dedupeReviewQueryEffects(
  effects: readonly ReviewQueryEffect[],
): readonly ReviewQueryEffect[] {
  const seen = new Set<string>()
  return effects.filter((effect) => {
    const key = JSON.stringify(effect)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
