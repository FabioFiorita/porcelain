import {
  dedupeSearchQueryEffects,
  type SearchForeignDependency,
  type SearchQuery,
  type SearchQueryEffect,
  searchForeignDependencyEffects,
  searchQuerySchema,
} from '@porcelain/client-runtime/search'
import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'

export type { SearchForeignDependency } from '@porcelain/client-runtime/search'

const searchQueryKeySchema = z.tuple([z.literal('daemon'), z.string(), searchQuerySchema])

export type SearchQueryKey = readonly ['daemon', string, SearchQuery]

export function searchQueryKey(environmentId: string, query: SearchQuery): SearchQueryKey {
  return ['daemon', environmentId, query] as const
}

export function parseSearchQueryKey(
  queryKey: readonly unknown[],
): { environmentId: string; query: SearchQuery } | null {
  const parsed = searchQueryKeySchema.safeParse(queryKey)
  return parsed.success ? { environmentId: parsed.data[1], query: parsed.data[2] } : null
}

export function isSearchQueryKey(queryKey: readonly unknown[]): boolean {
  return searchQueryKeySchema.safeParse(queryKey).success
}

export function searchQueryMatchesEffect(
  queryKey: readonly unknown[],
  effect: SearchQueryEffect,
  environmentId: string,
): boolean {
  const parsed = parseSearchQueryKey(queryKey)
  if (parsed === null || parsed.environmentId !== environmentId) return false
  return parsed.query.name === effect.type && parsed.query.projectPath === effect.projectPath
}

export function invalidateSearchEffects(
  queryClient: QueryClient,
  environmentId: string,
  effects: readonly SearchQueryEffect[],
): Promise<void> {
  return Promise.all(
    dedupeSearchQueryEffects(effects).map((effect) =>
      queryClient.invalidateQueries({
        predicate: (query) => searchQueryMatchesEffect(query.queryKey, effect, environmentId),
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
  environmentId: string,
  projectPath: string,
): Promise<void> {
  return queryClient
    .invalidateQueries({
      predicate: (query) => {
        const parsed = parseSearchQueryKey(query.queryKey)
        return (
          parsed !== null &&
          parsed.environmentId === environmentId &&
          parsed.query.projectPath === projectPath
        )
      },
    })
    .then(() => undefined)
}

export function exactSearchQueryKey(environmentId: string, query: SearchQuery): readonly unknown[] {
  return searchQueryKey(environmentId, query)
}

export function applySearchForeignDependencies(
  queryClient: QueryClient,
  environmentId: string,
  projectPath: string,
  dependencies: readonly SearchForeignDependency[],
): Promise<void> {
  return invalidateSearchEffects(
    queryClient,
    environmentId,
    searchForeignDependencyEffects(projectPath, dependencies),
  )
}
