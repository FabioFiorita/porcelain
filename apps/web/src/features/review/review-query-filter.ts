import {
  dedupeReviewQueryEffects,
  type ReviewQueryEffect,
  reviewQueryEffectMatchesQuery,
} from '@porcelain/client-runtime/review'
import { invalidateGitEffects } from '@renderer/features/git'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import type { QueryClient } from '@tanstack/react-query'

import { isReviewQueryKey, parseReviewQueryKey, reviewQueryKey } from './review-query-key'

/**
 * Review effect → cache invalidation (REV-007), following `features/git/git-query-filter.ts`.
 *
 * `reviewed-paths` and `worktree-inbox` are Review identities that REV-006 froze inside the
 * **Git** key namespace (both app key parsers validate against `gitWorkspaceQuerySchema`), so
 * this filter partitions the effect list and forwards those two through Git's public entry.
 * Everything else is matched by the Review key predicate, which is how the
 * `evidence-asset-family` effect reaches every per-file asset key of one project.
 */

/** The two Review identities REV-006 froze inside the Git key namespace. */
type GitKeyedReviewEffect = Extract<
  ReviewQueryEffect,
  { readonly name: 'reviewed-paths' | 'worktree-inbox' }
>

function isGitKeyed(effect: ReviewQueryEffect): effect is GitKeyedReviewEffect {
  return effect.name === 'reviewed-paths' || effect.name === 'worktree-inbox'
}

function sameDaemon(a: DaemonScope, b: DaemonScope): boolean {
  return a.host === b.host && a.version === b.version
}

/** Match one typed Review effect against one Web semantic cache key. */
export function reviewQueryMatchesEffect(
  queryKey: readonly unknown[],
  effect: ReviewQueryEffect,
  daemon: DaemonScope,
): boolean {
  const parsed = parseReviewQueryKey(queryKey)
  return (
    parsed !== null &&
    sameDaemon(parsed.daemon, daemon) &&
    reviewQueryEffectMatchesQuery(parsed.query, effect)
  )
}

/** Invalidate only the exact/family Review identities a mutation or notification named. */
export async function invalidateReviewEffects(
  queryClient: QueryClient,
  daemon: DaemonScope,
  effects: readonly ReviewQueryEffect[],
): Promise<void> {
  const deduped = dedupeReviewQueryEffects(effects)
  const gitKeyed = deduped.filter(isGitKeyed)
  const reviewKeyed = deduped.filter((effect) => !isGitKeyed(effect))
  await Promise.all([
    gitKeyed.length === 0 ? Promise.resolve() : invalidateGitEffects(queryClient, daemon, gitKeyed),
    ...reviewKeyed.map((effect) =>
      queryClient.invalidateQueries({
        predicate: (query) => reviewQueryMatchesEffect(query.queryKey, effect, daemon),
      }),
    ),
  ])
}

/** Session recovery for every exact Review cache identity on this client. */
export function invalidateAllReviewQueries(queryClient: QueryClient): Promise<void> {
  return queryClient
    .invalidateQueries({ predicate: (query) => isReviewQueryKey(query.queryKey) })
    .then(() => undefined)
}

/** Project-gap recovery for all exact Review identities carrying the missed project path. */
export function invalidateReviewProject(
  queryClient: QueryClient,
  daemon: DaemonScope,
  projectPath: string,
): Promise<void> {
  return queryClient
    .invalidateQueries({
      predicate: (query) => {
        const parsed = parseReviewQueryKey(query.queryKey)
        return (
          parsed !== null &&
          sameDaemon(parsed.daemon, daemon) &&
          parsed.query.projectPath === projectPath
        )
      },
    })
    .then(() => undefined)
}

export { isReviewQueryKey, parseReviewQueryKey, reviewQueryKey }
