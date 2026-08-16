import {
  type ProjectDataQuery,
  projectDataQuerySchema,
} from '@porcelain/client-runtime/project-data'
import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'

/**
 * Mobile React Query keys for Project Data (PDT-003).
 *
 * Cache rows hold dispositions / visibility under their typed identities.
 */

const projectDataQueryKeySchema = z.tuple([
  z.literal('daemon'),
  z.string().min(1),
  projectDataQuerySchema,
])

export function projectDataQueryKey(
  environmentId: string,
  query: ProjectDataQuery,
): readonly ['daemon', string, ProjectDataQuery] {
  return ['daemon', environmentId, query] as const
}

export function isProjectDataQueryKey(queryKey: readonly unknown[]): boolean {
  return projectDataQueryKeySchema.safeParse(queryKey).success
}

export function invalidateAllProjectDataQueries(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => isProjectDataQueryKey(query.queryKey),
  })
}

/** Invalidate exact keys for identities, deduped by name+projectPath. */
export function invalidateProjectDataIdentities(
  queryClient: QueryClient,
  environmentId: string,
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
        queryKey: projectDataQueryKey(environmentId, identity),
        exact: true,
      }),
    )
  }
  return Promise.all(tasks).then(() => undefined)
}
