import {
  type TerminalSessionsQuery,
  terminalSessionsQuery,
  terminalSessionsQuerySchema,
} from '@porcelain/client-runtime/terminal'
import { type DaemonScope, daemonScopeSchema } from '@renderer/lib/daemon-scope'
import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'

/**
 * Web React Query keys for Terminal roster (TRM-006).
 *
 * Primary key is identity + daemon scope (same shape family as Actions).
 * The identity is daemon-global; project filtering is adapter presentation.
 */

const terminalSessionsQueryKeySchema = z.tuple([terminalSessionsQuerySchema, daemonScopeSchema])

export function terminalSessionsQueryKey(
  daemon: DaemonScope,
  query: TerminalSessionsQuery,
): readonly [TerminalSessionsQuery, DaemonScope] {
  return [query, { host: daemon.host, version: daemon.version }] as const
}

export function isTerminalSessionsQueryKey(queryKey: readonly unknown[]): boolean {
  return terminalSessionsQueryKeySchema.safeParse(queryKey).success
}

/** Invalidate the daemon-global sessions row for one daemon scope. */
export function invalidateTerminalSessionsQueries(
  queryClient: QueryClient,
  daemon: DaemonScope,
): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: terminalSessionsQueryKey(daemon, terminalSessionsQuery()),
    exact: true,
  })
}
