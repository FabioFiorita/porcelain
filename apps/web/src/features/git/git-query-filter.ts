import {
  type GitQueryEffect,
  gitDiffQuery,
  gitFlowQuery,
  gitQueryEffectMatchesQuery,
  gitQueryProjectPath,
} from '@porcelain/client-runtime/git'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import type { QueryClient } from '@tanstack/react-query'

import { gitQueryKey, isGitQueryKey, parseGitQueryKey } from './git-query-key'

function sameDaemon(a: DaemonScope, b: DaemonScope): boolean {
  return a.host === b.host && a.version === b.version
}

/** Match one typed Git effect against one Web semantic cache key. */
export function gitQueryMatchesEffect(
  queryKey: readonly unknown[],
  effect: GitQueryEffect,
  daemon: DaemonScope,
): boolean {
  const parsed = parseGitQueryKey(queryKey)
  return (
    parsed !== null &&
    sameDaemon(parsed.daemon, daemon) &&
    gitQueryEffectMatchesQuery(parsed.query, effect)
  )
}

/** Invalidate only the exact/family Git identities named by a mutation or notification. */
export async function invalidateGitEffects(
  queryClient: QueryClient,
  daemon: DaemonScope,
  effects: readonly GitQueryEffect[],
): Promise<void> {
  await Promise.all(
    effects.map((effect) =>
      queryClient.invalidateQueries({
        predicate: (query) => gitQueryMatchesEffect(query.queryKey, effect, daemon),
      }),
    ),
  )
}

/** Session recovery for every exact Git cache identity, including daemon-scoped model options. */
export function invalidateAllGitQueries(queryClient: QueryClient): Promise<void> {
  return queryClient
    .invalidateQueries({ predicate: (query) => isGitQueryKey(query.queryKey) })
    .then(() => undefined)
}

/** Project-gap recovery for all exact Git identities that carry the missed project path. */
export function invalidateGitProject(
  queryClient: QueryClient,
  daemon: DaemonScope,
  projectPath: string,
): Promise<void> {
  return queryClient
    .invalidateQueries({
      predicate: (query) => {
        const parsed = parseGitQueryKey(query.queryKey)
        return (
          parsed !== null &&
          sameDaemon(parsed.daemon, daemon) &&
          gitQueryProjectPath(parsed.query) === projectPath
        )
      },
    })
    .then(() => undefined)
}

/** Files-owned foreign freshness handoff for working-tree mutations. */
export function invalidateGitWorkingTree(
  queryClient: QueryClient,
  daemon: DaemonScope,
  projectPath: string,
): Promise<void> {
  return invalidateGitEffects(queryClient, daemon, [
    gitFlowQuery(projectPath),
    gitDiffQuery(projectPath),
  ])
}

export { gitQueryKey, isGitQueryKey, parseGitQueryKey }
