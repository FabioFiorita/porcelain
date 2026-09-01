import {
  type ActionsIdentity,
  type ActionsQuery,
  actionsIdentitySchema,
  actionsQuery,
  actionsQuerySchema,
} from '@porcelain/client-runtime/actions'
import { type DaemonScope, daemonScopeSchema } from '@renderer/lib/daemon-scope'
import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'

/**
 * Web React Query keys for Actions.
 *
 * Cache rows hold ActionView[] under the list identity only. Trust identities from
 * Actions identities collapse onto the same project list key — never a second wire call or row.
 */

export type ActionsDaemonScope = DaemonScope

const actionsListQueryKeySchema = z.tuple([actionsQuerySchema, daemonScopeSchema])
/** Accept list or trust identity shapes so a stray trust-shaped key can still recover. */
const actionsAnyQueryKeySchema = z.tuple([actionsIdentitySchema, daemonScopeSchema])

/** React Query key: list identity + daemon scope. Trust identity collapses to the same list row. */
export function actionsListQueryKey(
  daemon: ActionsDaemonScope,
  query: ActionsQuery,
): readonly [ActionsQuery, ActionsDaemonScope] {
  return [query, { host: daemon.host, version: daemon.version }] as const
}

/** Build list key for a Project id. */
export function actionsListKeyForProject(
  daemon: ActionsDaemonScope,
  projectId: string,
): readonly [ActionsQuery, ActionsDaemonScope] {
  return actionsListQueryKey(daemon, actionsQuery(projectId))
}

/**
 * Map any shared Actions identity to the cache key that holds ActionView[] for that Project.
 * list → list key; trust → list key for the same projectId (collapse).
 */
export function actionsCacheKeyForIdentity(
  daemon: ActionsDaemonScope,
  identity: ActionsIdentity,
): readonly [ActionsQuery, ActionsDaemonScope] {
  return actionsListKeyForProject(daemon, identity.projectId)
}

/** True when a React Query key is an Actions identity (list or trust) + daemon scope. */
export function isActionsQueryKey(queryKey: readonly unknown[]): boolean {
  return actionsAnyQueryKeySchema.safeParse(queryKey).success
}

/** Invalidate every Actions cache entry (session/project recovery). */
export function invalidateAllActionsQueries(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => isActionsQueryKey(query.queryKey),
  })
}

/**
 * Invalidate list cache keys for the given identities, deduped by projectId.
 * Trust identities collapse to the same list key as list identities for that project.
 */
export function invalidateActionsIdentities(
  queryClient: QueryClient,
  daemon: ActionsDaemonScope,
  identities: readonly ActionsIdentity[],
): Promise<void> {
  const seen = new Set<string>()
  const tasks: Promise<void>[] = []
  for (const identity of identities) {
    if (seen.has(identity.projectId)) continue
    seen.add(identity.projectId)
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: actionsCacheKeyForIdentity(daemon, identity),
        exact: true,
      }),
    )
  }
  return Promise.all(tasks).then(() => undefined)
}

/** @internal test helper — strict list-key parse (not trust). */
export function parseActionsListQueryKey(
  queryKey: readonly unknown[],
): { query: ActionsQuery; daemon: ActionsDaemonScope } | null {
  const parsed = actionsListQueryKeySchema.safeParse(queryKey)
  if (!parsed.success) return null
  const [query, daemon] = parsed.data
  return { query, daemon }
}
