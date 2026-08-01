import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback } from 'react'

import { getDaemonClient } from './client'
import { type EnvironmentId, isPaired } from './environment'
import { useActiveEnvironment } from './environments-store'
import { DaemonError } from './errors'
import { callDaemon, type DaemonMutation, type DaemonQuery } from './procedure'
import { useDaemonSession } from './session'

/**
 * `['daemon', envId, name, input ?? null]`. The environment id sits in the key so switching
 * daemons can never serve another one's cache, and unpairing is a single `removeQueries` on
 * `daemonKeys.environment(id)`. Repo scoping rides inside `input`.
 */
export const daemonKeys = {
  environment: (envId: EnvironmentId) => ['daemon', envId] as const,
  procedure: (envId: EnvironmentId, name: string) => ['daemon', envId, name] as const,
  call: (envId: EnvironmentId, name: string, input: unknown) =>
    ['daemon', envId, name, input ?? null] as const,
}

const NO_ENVIRONMENT = new DaemonError(
  'unreachable',
  'unknown',
  'No daemon is paired with this device.',
)

export function useDaemonQuery<TInput, TOutput>(
  procedure: DaemonQuery<TInput, TOutput>,
  input: TInput,
  options?: {
    enabled?: boolean
    staleTime?: number
    /** Backstop poll interval in ms, applied only while the socket is down. */
    backstopMs?: number
  },
): UseQueryResult<TOutput, DaemonError> {
  const environment = useActiveEnvironment()
  const session = useDaemonSession()
  const backstop = options?.backstopMs

  return useQuery<TOutput, DaemonError>({
    enabled: isPaired(environment) && (options?.enabled ?? true),
    queryFn: async (): Promise<TOutput> => {
      if (!isPaired(environment)) throw NO_ENVIRONMENT
      return await callDaemon(getDaemonClient(environment), procedure, input)
    },
    queryKey: daemonKeys.call(environment?.id ?? 'none', procedure.name, input),
    // A healthy socket carries the truth, so polling is off; React Query already suspends
    // intervals while the app is unfocused (`refetchIntervalInBackground` stays false).
    refetchInterval: backstop !== undefined && session.status !== 'open' ? backstop : false,
    staleTime: options?.staleTime,
  })
}

export function useDaemonMutation<TInput, TOutput>(
  procedure: DaemonMutation<TInput, TOutput>,
  options?: { invalidates?: readonly string[] },
): UseMutationResult<TOutput, DaemonError, TInput> {
  const environment = useActiveEnvironment()
  const invalidate = useDaemonInvalidate()
  const invalidates = options?.invalidates

  return useMutation<TOutput, DaemonError, TInput>({
    mutationFn: async (input: TInput): Promise<TOutput> => {
      if (!isPaired(environment)) throw NO_ENVIRONMENT
      return await callDaemon(getDaemonClient(environment), procedure, input)
    },
    onSuccess: (): void => {
      if (invalidates !== undefined) invalidate(invalidates)
    },
  })
}

/** Imperative invalidation by procedure name, scoped to the active environment. */
export function useDaemonInvalidate(): (names: readonly string[]) => void {
  const client = useQueryClient()
  const environment = useActiveEnvironment()

  return useCallback(
    (names: readonly string[]): void => {
      if (environment === null) return
      for (const name of names) {
        client.invalidateQueries({ queryKey: daemonKeys.procedure(environment.id, name) })
      }
    },
    [client, environment],
  )
}
