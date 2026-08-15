import {
  type ActionsIdentity,
  type ActionsQuery,
  actionsIdentitySchema,
  actionsProjectKey,
} from '@porcelain/client-runtime/actions'
import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'

/**
 * Mobile React Query keys for Actions (ACT-003).
 *
 * Cache rows hold ActionView[] under the list identity only. Trust identities collapse
 * onto the same project list key.
 */

function listIdentity(projectId: string): ActionsQuery {
  return {
    domain: 'actions',
    name: 'list',
    projectId: actionsProjectKey(projectId),
  }
}

const listIdentitySchema = z
  .object({
    domain: z.literal('actions'),
    name: z.literal('list'),
    projectId: z.string().min(1),
  })
  .strict()

const listKeySchema = z.tuple([z.literal('daemon'), z.string().min(1), listIdentitySchema])
const anyKeySchema = z.tuple([z.literal('daemon'), z.string().min(1), actionsIdentitySchema])

export function actionsListQueryKey(
  environmentId: string,
  query: ActionsQuery,
): readonly ['daemon', string, ActionsQuery] {
  return ['daemon', environmentId, query] as const
}

export function actionsListKeyForProject(
  environmentId: string,
  projectId: string,
): readonly ['daemon', string, ActionsQuery] {
  return actionsListQueryKey(environmentId, listIdentity(projectId))
}

/**
 * Map any ACT-002 identity to the cache key that holds ActionView[] for that project.
 * Trust collapses to the list identity shape in the key.
 */
export function actionsCacheKeyForIdentity(
  environmentId: string,
  identity: ActionsIdentity,
): readonly ['daemon', string, ActionsQuery] {
  return actionsListKeyForProject(environmentId, identity.projectId)
}

export function isActionsQueryKey(queryKey: readonly unknown[]): boolean {
  return anyKeySchema.safeParse(queryKey).success
}

export function invalidateAllActionsQueries(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => isActionsQueryKey(query.queryKey),
  })
}

/** Invalidate list keys for identities, deduped by Project id. */
export function invalidateActionsIdentities(
  queryClient: QueryClient,
  environmentId: string,
  identities: readonly ActionsIdentity[],
): Promise<void> {
  const seen = new Set<string>()
  const tasks: Promise<void>[] = []
  for (const identity of identities) {
    if (seen.has(identity.projectId)) continue
    seen.add(identity.projectId)
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: actionsCacheKeyForIdentity(environmentId, identity),
        exact: true,
      }),
    )
  }
  return Promise.all(tasks).then(() => undefined)
}

/** @internal test helper */
export function parseActionsListQueryKey(
  queryKey: readonly unknown[],
): { environmentId: string; query: ActionsQuery } | null {
  const parsed = listKeySchema.safeParse(queryKey)
  if (!parsed.success) return null
  const [, environmentId, query] = parsed.data
  return { environmentId, query }
}
