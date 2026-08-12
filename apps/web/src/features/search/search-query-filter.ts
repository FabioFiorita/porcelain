import {
  dedupeSearchQueryEffects,
  type SearchQuery,
  type SearchQueryEffect,
} from '@porcelain/client-runtime/search'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import type { QueryClient } from '@tanstack/react-query'

import { isSearchQueryKey, parseSearchQueryKey, searchQueryKey } from './search-query-key'

function sameDaemon(a: DaemonScope, b: DaemonScope): boolean {
  return a.host === b.host && a.version === b.version
}

function sameProject(query: SearchQuery, projectPath: string): boolean {
  return query.projectPath === projectPath
}

export function searchQueryMatchesEffect(
  queryKey: readonly unknown[],
  effect: SearchQueryEffect,
  daemon: DaemonScope,
): boolean {
  const parsed = parseSearchQueryKey(queryKey)
  if (parsed === null || !sameDaemon(parsed.daemon, daemon)) return false
  switch (effect.type) {
    case 'files':
      return parsed.query.name === 'files' && sameProject(parsed.query, effect.projectPath)
    case 'text':
      return parsed.query.name === 'text' && sameProject(parsed.query, effect.projectPath)
    case 'code':
      return parsed.query.name === 'code' && sameProject(parsed.query, effect.projectPath)
    default: {
      const _exhaustive: never = effect
      return _exhaustive
    }
  }
}

export function invalidateSearchEffects(
  queryClient: QueryClient,
  daemon: DaemonScope,
  effects: readonly SearchQueryEffect[],
): Promise<void> {
  return Promise.all(
    dedupeSearchQueryEffects(effects).map((effect) =>
      queryClient.invalidateQueries({
        predicate: (query) => searchQueryMatchesEffect(query.queryKey, effect, daemon),
      }),
    ),
  ).then(() => undefined)
}

export function invalidateAllSearchQueries(queryClient: QueryClient): Promise<void> {
  return queryClient
    .invalidateQueries({ predicate: (query) => isSearchQueryKey(query.queryKey) })
    .then(() => undefined)
}

export function invalidateSearchProjectQueries(
  queryClient: QueryClient,
  daemon: DaemonScope,
  projectPath: string,
): Promise<void> {
  return queryClient
    .invalidateQueries({
      predicate: (query) => {
        const parsed = parseSearchQueryKey(query.queryKey)
        return (
          parsed !== null &&
          sameDaemon(parsed.daemon, daemon) &&
          parsed.query.projectPath === projectPath
        )
      },
    })
    .then(() => undefined)
}

export function exactSearchQueryKey(daemon: DaemonScope, query: SearchQuery): readonly unknown[] {
  return searchQueryKey(daemon, query)
}
