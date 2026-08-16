import {
  type ProjectDataQuery,
  projectDataQuerySchema,
} from '@porcelain/client-runtime/project-data'
import { type DaemonScope, daemonScopeSchema } from '@renderer/lib/daemon-scope'
import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'

/**
 * Web React Query keys for Project Data (PDT-003).
 *
 * Cache rows hold dispositions / visibility under their typed identities.
 * Procedure-name strings never appear here.
 */

const projectDataQueryKeySchema = z.tuple([projectDataQuerySchema, daemonScopeSchema])

export function projectDataQueryKey(
  daemon: DaemonScope,
  query: ProjectDataQuery,
): readonly [ProjectDataQuery, DaemonScope] {
  return [query, { host: daemon.host, version: daemon.version }] as const
}

/** True when a React Query key is a Project Data identity + daemon scope. */
export function isProjectDataQueryKey(queryKey: readonly unknown[]): boolean {
  return projectDataQueryKeySchema.safeParse(queryKey).success
}

/** Invalidate every Project Data cache entry (session/project recovery). */
export function invalidateAllProjectDataQueries(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => isProjectDataQueryKey(query.queryKey),
  })
}
