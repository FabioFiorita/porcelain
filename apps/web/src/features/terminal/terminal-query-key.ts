import type { TerminalSessionsQuery } from '@porcelain/client-runtime/terminal'
import type { DaemonScope } from '@renderer/lib/daemon-scope'

/**
 * Web React Query key for the Terminal roster.
 *
 * Key is identity + daemon scope (same shape family as Actions).
 * The identity is daemon-global; project filtering is adapter presentation.
 */
export function terminalSessionsQueryKey(
  daemon: DaemonScope,
  query: TerminalSessionsQuery,
): readonly [TerminalSessionsQuery, DaemonScope] {
  return [query, { host: daemon.host, version: daemon.version }] as const
}
