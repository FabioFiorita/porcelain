import {
  type TerminalSessionsQuery,
  terminalSessionsQuery,
  terminalSessionsQuerySchema,
} from '@porcelain/client-runtime/terminal'
import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'

/**
 * Mobile React Query keys for Terminal roster.
 *
 * Same shape family as Actions: `['daemon', environmentId, identity]`.
 */

const sessionsKeySchema = z.tuple([
  z.literal('daemon'),
  z.string().min(1),
  terminalSessionsQuerySchema,
])

export function terminalSessionsQueryKey(
  environmentId: string,
  query: TerminalSessionsQuery,
): readonly ['daemon', string, TerminalSessionsQuery] {
  return ['daemon', environmentId, query] as const
}

export function isTerminalSessionsQueryKey(queryKey: readonly unknown[]): boolean {
  return sessionsKeySchema.safeParse(queryKey).success
}

export function invalidateTerminalSessionsQueries(
  queryClient: QueryClient,
  environmentId: string,
): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: terminalSessionsQueryKey(environmentId, terminalSessionsQuery()),
    exact: true,
  })
}
