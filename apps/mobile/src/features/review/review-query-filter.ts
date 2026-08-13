import {
  dedupeReviewQueryEffects,
  type ReviewQueryEffect,
  reviewProjectKey,
  reviewQueryEffectMatchesQuery,
} from '@porcelain/client-runtime/review'
import type { QueryClient } from '@tanstack/react-query'

import { invalidateReviewedPaths } from '@/features/changes/use-changes'

import { parseReviewQueryKey } from './review-query-key'

/**
 * Match one typed effect against one cached Review identity.
 *
 * The `evidence-asset-family` effect matches every per-file asset identity of its project; an
 * exact effect matches only the identical identity. The shared runtime owns that rule so both
 * clients cannot drift on what "stale" means.
 */
export function reviewQueryMatchesEffect(
  queryKey: readonly unknown[],
  effect: ReviewQueryEffect,
  environmentId: string,
): boolean {
  const parsed = parseReviewQueryKey(queryKey)
  return (
    parsed !== null &&
    parsed.environmentId === environmentId &&
    reviewQueryEffectMatchesQuery(parsed.query, effect)
  )
}

/**
 * Invalidate exactly the Review identities named by a mutation or notification.
 *
 * `reviewed-paths` is the one effect whose cache entry belongs to another feature: the ticks
 * are read from the Changes surface through `useDaemonQuery`, so that entry is still keyed by
 * procedure name. Forwarding it to its owner keeps the name out of this feature and keeps the
 * one cache entry with exactly one owner.
 */
export function invalidateReviewEffects(
  queryClient: QueryClient,
  environmentId: string,
  effects: readonly ReviewQueryEffect[],
): Promise<void> {
  return Promise.all(
    dedupeReviewQueryEffects(effects).map((effect) =>
      effect.name === 'reviewed-paths'
        ? invalidateReviewedPaths(queryClient, environmentId)
        : queryClient.invalidateQueries({
            predicate: (query) => reviewQueryMatchesEffect(query.queryKey, effect, environmentId),
          }),
    ),
  ).then(() => undefined)
}

/** Session recovery: every Review identity this environment holds. */
export function invalidateAllReviewQueries(
  queryClient: QueryClient,
  environmentId: string,
): Promise<void> {
  return queryClient
    .invalidateQueries({
      predicate: (query) => {
        const parsed = parseReviewQueryKey(query.queryKey)
        return parsed !== null && parsed.environmentId === environmentId
      },
    })
    .then(() => undefined)
}

/** Project-gap recovery: only the identities carrying this project path. */
export function invalidateReviewProject(
  queryClient: QueryClient,
  environmentId: string,
  projectPath: string,
): Promise<void> {
  const projectKey = reviewProjectKey(projectPath)
  return queryClient
    .invalidateQueries({
      predicate: (query) => {
        const parsed = parseReviewQueryKey(query.queryKey)
        return (
          parsed !== null &&
          parsed.environmentId === environmentId &&
          parsed.query.projectPath === projectKey
        )
      },
    })
    .then(() => undefined)
}
