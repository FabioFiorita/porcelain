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
 * Cache rows hold notes / layers / dispositions / visibility under their typed identities.
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

function parseProjectDataQueryKey(
  queryKey: readonly unknown[],
): { query: ProjectDataQuery; daemon: DaemonScope } | null {
  const parsed = projectDataQueryKeySchema.safeParse(queryKey)
  if (!parsed.success) return null
  const [query, daemon] = parsed.data
  return { query, daemon }
}

/** Invalidate every Project Data cache entry (session/project recovery). */
export function invalidateAllProjectDataQueries(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => isProjectDataQueryKey(query.queryKey),
  })
}

/**
 * Invalidate exact cache keys for the given identities, deduped by name+projectPath.
 */
export function invalidateProjectDataIdentities(
  queryClient: QueryClient,
  daemon: DaemonScope,
  identities: readonly ProjectDataQuery[],
): Promise<void> {
  const seen = new Set<string>()
  const tasks: Promise<void>[] = []
  for (const identity of identities) {
    const key = `${identity.name}\0${identity.projectPath}`
    if (seen.has(key)) continue
    seen.add(key)
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: projectDataQueryKey(daemon, identity),
        exact: true,
      }),
    )
  }
  return Promise.all(tasks).then(() => undefined)
}

/** Invalidate every layers identity (review.changed). */
export function invalidateProjectDataLayers(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const parsed = parseProjectDataQueryKey(query.queryKey)
      return parsed !== null && parsed.query.name === 'layers'
    },
  })
}
