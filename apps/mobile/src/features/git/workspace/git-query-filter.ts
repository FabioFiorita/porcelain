import type { GitWorkspaceQuery } from '@porcelain/client-runtime/git'
import type { QueryClient } from '@tanstack/react-query'

import {
  gitWorkspaceQueryKey,
  isGitWorkspaceQueryKey,
  parseGitWorkspaceQueryKey,
} from './git-query-key'

function sameIdentity(a: GitWorkspaceQuery, b: GitWorkspaceQuery): boolean {
  return a.domain === b.domain && a.name === b.name && a.projectPath === b.projectPath
}

/** Match one typed GIT-003 effect against one mobile semantic cache key. */
export function gitWorkspaceQueryMatchesEffect(
  queryKey: readonly unknown[],
  effect: GitWorkspaceQuery,
  environmentId: string,
): boolean {
  const parsed = parseGitWorkspaceQueryKey(queryKey)
  return (
    parsed !== null && parsed.environmentId === environmentId && sameIdentity(parsed.query, effect)
  )
}

/** Invalidate only the semantic Git identities named by a mutation or notification. */
export async function invalidateGitWorkspaceEffects(
  queryClient: QueryClient,
  environmentId: string,
  effects: readonly GitWorkspaceQuery[],
): Promise<void> {
  await Promise.all(
    effects.map((effect) =>
      queryClient.invalidateQueries({
        exact: true,
        queryKey: gitWorkspaceQueryKey(environmentId, effect),
      }),
    ),
  )
}

/** Session recovery for the semantic Git workspace cache only. */
export function invalidateAllGitWorkspaceQueries(queryClient: QueryClient): Promise<void> {
  return queryClient
    .invalidateQueries({ predicate: (query) => isGitWorkspaceQueryKey(query.queryKey) })
    .then(() => undefined)
}
