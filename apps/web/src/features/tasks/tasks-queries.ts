import { aggregateTaskRows, type TaskRow } from '@porcelain/client-runtime/tasks'
import type { Task } from '@porcelain/contracts/tasks'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import {
  browserEnvironmentConnections,
  ensureEnvironmentSession,
  useEnvironmentSessionsRevision,
} from '@renderer/lib/environment-sessions'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc, trpc } from '@renderer/lib/trpc'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { tasksKeyForEnvironment } from './tasks-query-key'

/**
 * Reading the Tasks table.
 *
 * Two runtimes, one view. The browser reads the serving daemon plus each explicit client-local
 * Environment session. The Electron shell uses its main-process fan-out. Every path omits an
 * Environment that did not answer instead of showing rows nobody can write to.
 */

export type TasksView = {
  readonly rows: TaskRow[]
  /** Environments contributing rows right now — the Quick Add target list. */
  readonly environments: readonly { id: string | null; name: string }[]
  /** Non-null when the read failed (distinct from unloaded and from an empty table). */
  readonly error: string | null
  /** False until the first settlement; true after success or failure. */
  readonly isLoaded: boolean
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message
  return 'Could not load Tasks'
}

const EMPTY_ENVIRONMENTS: readonly { id: string | null; name: string; tasks: Task[] }[] = []

/** The single directly-connected daemon's table (browser client). */
function useLocalTasks(enabled: boolean): {
  data: { id: string | null; name: string; tasks: Task[] }[] | undefined
  error: unknown
  isPending: boolean
} {
  const daemon = useDaemonIdentity()
  const environmentSessionsRevision = useEnvironmentSessionsRevision()
  const daemonScope: DaemonScope = { host: daemon.host, version: daemon.version }
  const utils = trpc.useUtils()
  const name = daemon.host ?? 'This device'

  const query = useQuery({
    queryKey: tasksKeyForEnvironment(daemonScope, null),
    queryFn: async (): Promise<Task[]> => utils.client.listTasks.query(),
    enabled,
  })

  const secondaryConnections = useMemo(
    () => (enabled ? browserEnvironmentConnections(environmentSessionsRevision) : []),
    [enabled, environmentSessionsRevision],
  )
  const secondarySessions = useMemo(
    () => secondaryConnections.map((connection) => ensureEnvironmentSession(connection)),
    [secondaryConnections],
  )
  const secondaryQueries = useQueries({
    queries: secondarySessions.map((entry) => ({
      enabled,
      queryKey: ['browser', 'tasks', entry.id],
      queryFn: async (): Promise<Task[]> => entry.client.listTasks.query(),
    })),
  })
  useEffect(() => {
    for (const entry of secondarySessions) entry.session.start()
  }, [secondarySessions])

  const secondary = secondaryQueries.flatMap((remote, index) => {
    const connection = secondaryConnections[index]
    return remote.data === undefined || connection === undefined
      ? []
      : [{ id: connection.id, name: connection.name, tasks: remote.data }]
  })
  const data =
    query.data === undefined ? undefined : [{ id: null, name, tasks: query.data }, ...secondary]

  return {
    data,
    error: query.isError || secondaryQueries.some((remote) => remote.isError) ? query.error : null,
    isPending: query.isPending || secondaryQueries.some((remote) => remote.isPending),
  }
}

/** Every online Environment's table, fanned out by the shell (Electron only). */
function useShellTasks(enabled: boolean): {
  data: { id: string | null; name: string; tasks: Task[] }[] | undefined
  error: unknown
  isPending: boolean
} {
  const query = shellTrpc.environmentTasks.useQuery(undefined, {
    enabled,
    refetchOnWindowFocus: true,
  })
  return {
    data: query.data,
    error: query.isError ? query.error : null,
    isPending: query.isPending,
  }
}

/** Every Task the Hub can currently reach, newest first, labelled by Environment. */
export function useTasks(): TasksView {
  const local = useLocalTasks(isBrowser)
  const shell = useShellTasks(!isBrowser)
  const active = isBrowser ? local : shell

  const sources = active.data ?? EMPTY_ENVIRONMENTS
  const rows = useMemo(
    () =>
      aggregateTaskRows(
        sources.map((source) => ({
          environmentId: source.id,
          environmentName: source.name,
          tasks: source.tasks,
        })),
      ),
    [sources],
  )
  const environments = useMemo(
    () => sources.map((source) => ({ id: source.id, name: source.name })),
    [sources],
  )

  if (active.error !== null) {
    return { rows: [], environments: [], error: readErrorMessage(active.error), isLoaded: true }
  }
  if (active.isPending || active.data === undefined) {
    return { rows: [], environments: [], error: null, isLoaded: false }
  }
  return { rows, environments, error: null, isLoaded: true }
}
