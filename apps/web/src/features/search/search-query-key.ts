import { type SearchQuery, searchQuerySchema } from '@porcelain/client-runtime/search'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { daemonScopeSchema } from '@renderer/lib/daemon-scope'
import { z } from 'zod'

const searchQueryKeySchema = z.tuple([searchQuerySchema, daemonScopeSchema])

export type SearchQueryKey = readonly [SearchQuery, DaemonScope]

export function searchQueryKey(daemon: DaemonScope, query: SearchQuery): SearchQueryKey {
  return [query, { host: daemon.host, version: daemon.version }] as const
}

export function parseSearchQueryKey(
  queryKey: readonly unknown[],
): { query: SearchQuery; daemon: DaemonScope } | null {
  const parsed = searchQueryKeySchema.safeParse(queryKey)
  return parsed.success ? { daemon: parsed.data[1], query: parsed.data[0] } : null
}

export function isSearchQueryKey(queryKey: readonly unknown[]): boolean {
  return searchQueryKeySchema.safeParse(queryKey).success
}
