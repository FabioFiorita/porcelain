import {
  keepPreviousData,
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { getDaemonClient } from './client'
import { type EnvironmentId, isPaired } from './environment'
import { environmentActions, useActiveEnvironment } from './environments-store'
import { DaemonError, daemonErrorMessage } from './errors'
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

/**
 * One call, with the reachability bookkeeping every daemon read shares. Both the single-query and
 * the many-queries hook run through here so a tree of directory reads cannot drift into its own
 * error handling.
 */
function daemonQueryFn<TInput, TOutput>(
  environment: ReturnType<typeof useActiveEnvironment>,
  procedure: DaemonQuery<TInput, TOutput>,
  input: TInput,
): () => Promise<TOutput> {
  return async (): Promise<TOutput> => {
    if (!isPaired(environment)) throw NO_ENVIRONMENT
    try {
      const output = await callDaemon(getDaemonClient(environment), procedure, input)
      environmentActions.recordReachabilitySuccess(environment.id)
      return output
    } catch (error) {
      if (error instanceof DaemonError && error.kind === 'unreachable') {
        environmentActions.recordReachabilityFailure(environment.id, daemonErrorMessage(error))
      }
      throw error
    }
  }
}

export function useDaemonQuery<TInput, TOutput>(
  procedure: DaemonQuery<TInput, TOutput>,
  input: TInput,
  options?: {
    enabled?: boolean
    staleTime?: number
    gcTime?: number
    refetchOnWindowFocus?: boolean
    placeholderData?: 'keepPreviousData'
    /**
     * Poll interval in ms, applied whatever the socket is doing. Required for anything the
     * daemon only pushes to sessions that registered watches — a healthy socket is not a
     * promise of freshness. Gate it with `enabled` on screen focus.
     */
    pollMs?: number
    /** Backstop poll interval in ms, applied only while the socket is down. */
    backstopMs?: number
  },
): UseQueryResult<TOutput, DaemonError> {
  const environment = useActiveEnvironment()
  const session = useDaemonSession()
  const poll = options?.pollMs
  const backstop = options?.backstopMs

  return useQuery<TOutput, DaemonError>({
    enabled: isPaired(environment) && (options?.enabled ?? true),
    queryFn: daemonQueryFn(environment, procedure, input),
    queryKey: daemonKeys.call(environment?.id ?? 'none', procedure.name, input),
    // React Query already suspends intervals while the app is unfocused
    // (`refetchIntervalInBackground` stays false), so neither interval runs in the background.
    refetchInterval:
      poll ?? (backstop !== undefined && session.status !== 'open' ? backstop : false),
    gcTime: options?.gcTime,
    placeholderData: options?.placeholderData === 'keepPreviousData' ? keepPreviousData : undefined,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    staleTime: options?.staleTime,
  })
}

/**
 * The same read, fanned out over a set of inputs whose size changes as the user works — the file
 * tree reads one directory per open folder. Hook rules forbid a `useDaemonQuery` per folder, and a
 * component per folder is what the canvas exists to avoid, so the fan-out lives here on the one
 * daemon seam rather than in a second cache beside it.
 */
export function useDaemonQueries<TInput, TOutput>(
  procedure: DaemonQuery<TInput, TOutput>,
  inputs: readonly TInput[],
  options?: { enabled?: boolean; staleTime?: number; gcTime?: number },
): UseQueryResult<TOutput, DaemonError>[] {
  const environment = useActiveEnvironment()
  const enabled = isPaired(environment) && (options?.enabled ?? true)
  const gcTime = options?.gcTime
  const staleTime = options?.staleTime

  const queries = useMemo(
    () =>
      inputs.map((input) => ({
        enabled,
        gcTime,
        queryFn: daemonQueryFn(environment, procedure, input),
        queryKey: daemonKeys.call(environment?.id ?? 'none', procedure.name, input),
        refetchOnWindowFocus: false,
        staleTime,
      })),
    [enabled, environment, gcTime, inputs, procedure, staleTime],
  )

  return useQueries({ queries })
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
      try {
        const output = await callDaemon(getDaemonClient(environment), procedure, input)
        environmentActions.recordReachabilitySuccess(environment.id)
        return output
      } catch (error) {
        if (error instanceof DaemonError && error.kind === 'unreachable') {
          environmentActions.recordReachabilityFailure(environment.id, daemonErrorMessage(error))
        }
        throw error
      }
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
