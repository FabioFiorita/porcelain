import { type ReviewQuery, reviewQuerySchema } from '@porcelain/client-runtime/review'

/**
 * Mobile's one Review cache key: environment identity first, semantic query second.
 *
 * Every Review read in this client — reading, intent, evidence documents, the asset listing,
 * one asset's bytes, the publish cost and the archive list — is keyed this way, so one typed
 * effect predicate can decide what a mutation or notification made stale without ever naming
 * a procedure string. The key shape mirrors `features/git/git-query-key.ts`; the identity half
 * is validated by the shared `reviewQuerySchema`, so no Review schema is declared here.
 */

export type ReviewQueryKey = readonly ['daemon', string, ReviewQuery]

export function reviewQueryKey(environmentId: string, query: ReviewQuery): ReviewQueryKey {
  return ['daemon', environmentId, query] as const
}

export function parseReviewQueryKey(
  queryKey: readonly unknown[],
): { environmentId: string; query: ReviewQuery } | null {
  if (queryKey.length !== 3) return null
  const [head, environmentId, query] = queryKey
  if (head !== 'daemon' || typeof environmentId !== 'string') return null
  const parsed = reviewQuerySchema.safeParse(query)
  return parsed.success ? { environmentId, query: parsed.data } : null
}

export function isReviewQueryKey(queryKey: readonly unknown[]): boolean {
  return parseReviewQueryKey(queryKey) !== null
}
