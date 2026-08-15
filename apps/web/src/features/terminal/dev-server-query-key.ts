import { type DevServersQuery, devServersQuerySchema } from '@porcelain/client-runtime/terminal'
import { type DaemonScope, daemonScopeSchema } from '@renderer/lib/daemon-scope'
import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'

/**
 * Web React Query keys for the development-server roster.
 *
 * Same shape family as Terminal and Actions: `[identity, daemonScope]`, never a procedure
 * name. The identity carries Project + Worktree, so one daemon's two checkouts of the same
 * Project hold separate rows.
 */

/** The shape a roster cache key must have — asserted by the key suite, not by callers. */
export const devServersQueryKeySchema = z.tuple([devServersQuerySchema, daemonScopeSchema])

export function devServersQueryKey(
  daemon: DaemonScope,
  query: DevServersQuery,
): readonly [DevServersQuery, DaemonScope] {
  return [query, { host: daemon.host, version: daemon.version }] as const
}

/** Invalidate exactly the roster rows a change or mutation made stale. */
export function invalidateDevServerQueries(
  queryClient: QueryClient,
  daemon: DaemonScope,
  queries: readonly DevServersQuery[],
): Promise<void> {
  return Promise.all(
    queries.map((query) =>
      queryClient.invalidateQueries({ queryKey: devServersQueryKey(daemon, query), exact: true }),
    ),
  ).then(() => undefined)
}
