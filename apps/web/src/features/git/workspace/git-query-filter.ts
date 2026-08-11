import type { GitWorkspaceQuery } from '@porcelain/client-runtime/git'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import type { QueryClient } from '@tanstack/react-query'

import {
  gitWorkspaceQueryKey,
  isGitWorkspaceQueryKey,
  parseGitWorkspaceQueryKey,
} from './git-query-key'

function sameDaemon(a: DaemonScope, b: DaemonScope): boolean {
  return a.host === b.host && a.version === b.version
}

function sameIdentity(a: GitWorkspaceQuery, b: GitWorkspaceQuery): boolean {
  return a.domain === b.domain && a.name === b.name && a.projectPath === b.projectPath
}

/** Match one typed GIT-003 effect against one Web semantic cache key. */
export function gitWorkspaceQueryMatchesEffect(
  queryKey: readonly unknown[],
  effect: GitWorkspaceQuery,
  daemon: DaemonScope,
): boolean {
  const parsed = parseGitWorkspaceQueryKey(queryKey)
  return parsed !== null && sameDaemon(parsed.daemon, daemon) && sameIdentity(parsed.query, effect)
}

/** Invalidate only the semantic Git identities named by a mutation or notification. */
export async function invalidateGitWorkspaceEffects(
  queryClient: QueryClient,
  daemon: DaemonScope,
  effects: readonly GitWorkspaceQuery[],
): Promise<void> {
  await Promise.all(
    effects.map((effect) =>
      queryClient.invalidateQueries({
        exact: true,
        queryKey: gitWorkspaceQueryKey(daemon, effect),
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

/** Project-scoped recovery for the semantic Git workspace cache only. */
export function invalidateGitWorkspaceProject(
  queryClient: QueryClient,
  daemon: DaemonScope,
  projectPath: string,
): Promise<void> {
  return queryClient
    .invalidateQueries({
      predicate: (query) => {
        const parsed = parseGitWorkspaceQueryKey(query.queryKey)
        return (
          parsed !== null &&
          sameDaemon(parsed.daemon, daemon) &&
          parsed.query.projectPath === projectPath
        )
      },
    })
    .then(() => undefined)
}
