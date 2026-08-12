import {
  dedupeGitQueryEffects,
  type GitQueryEffect,
  gitDiffQuery,
  gitDiffReadingQuery,
  gitFlowQuery,
  gitProjectKey,
  gitQueryEffectMatchesQuery,
  gitStatusQuery,
  gitSuggestionsQuery,
} from '@porcelain/client-runtime/git'
import type { QueryClient } from '@tanstack/react-query'

import { isGitQueryKey, parseGitQueryKey } from './git-query-key'

/**
 * Match one typed effect against one cached Git identity.
 *
 * A family effect (working diff, range diff, log, file log, diff reading) matches every exact
 * identity in that family; an exact effect matches only the identical identity. The shared
 * runtime owns that rule so both clients cannot drift on what "stale" means.
 */
export function gitQueryMatchesEffect(
  queryKey: readonly unknown[],
  effect: GitQueryEffect,
  environmentId: string,
): boolean {
  const parsed = parseGitQueryKey(queryKey)
  return (
    parsed !== null &&
    parsed.environmentId === environmentId &&
    gitQueryEffectMatchesQuery(parsed.query, effect)
  )
}

/** Invalidate exactly the Git identities named by a mutation or notification. */
export function invalidateGitEffects(
  queryClient: QueryClient,
  environmentId: string,
  effects: readonly GitQueryEffect[],
): Promise<void> {
  return Promise.all(
    dedupeGitQueryEffects(effects).map((effect) =>
      queryClient.invalidateQueries({
        predicate: (query) => gitQueryMatchesEffect(query.queryKey, effect, environmentId),
      }),
    ),
  ).then(() => undefined)
}

/**
 * Session recovery: every Git identity this environment holds, including the daemon-scoped
 * commit-model list, which has no project dimension to recover by.
 */
export function invalidateAllGitQueries(
  queryClient: QueryClient,
  environmentId: string,
): Promise<void> {
  return queryClient
    .invalidateQueries({
      predicate: (query) => {
        const parsed = parseGitQueryKey(query.queryKey)
        return (
          parsed !== null && parsed.environmentId === environmentId && isGitQueryKey(query.queryKey)
        )
      },
    })
    .then(() => undefined)
}

/** Project-gap recovery: only the identities carrying this project path. */
export function invalidateGitProject(
  queryClient: QueryClient,
  environmentId: string,
  projectPath: string,
): Promise<void> {
  const projectKey = gitProjectKey(projectPath)
  return queryClient
    .invalidateQueries({
      predicate: (query) => {
        const parsed = parseGitQueryKey(query.queryKey)
        return (
          parsed !== null &&
          parsed.environmentId === environmentId &&
          'projectPath' in parsed.query &&
          parsed.query.projectPath === projectKey
        )
      },
    })
    .then(() => undefined)
}

/**
 * The public Git handoff for Files' `working-tree` foreign token: a file written, renamed or
 * trashed on disk moves the working tree, and nothing else.
 */
export function invalidateGitWorkingTree(
  queryClient: QueryClient,
  environmentId: string,
  projectPath: string,
): Promise<void> {
  const projectKey = gitProjectKey(projectPath)
  return invalidateGitEffects(queryClient, environmentId, [
    gitFlowQuery(projectKey),
    gitStatusQuery(projectKey),
    gitDiffQuery(projectKey),
    gitDiffReadingQuery(projectKey, { type: 'working' }),
    gitSuggestionsQuery(projectKey),
  ])
}
