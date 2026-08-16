import { tasksNotificationEffects } from '@porcelain/client-runtime/tasks'
import type { TasksChanged } from '@porcelain/contracts/tasks'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import type { LiveEnvironmentSession } from '@renderer/lib/environment-sessions'
import {
  daemonScopeForEnvironment,
  liveEnvironmentSessions,
  useEnvironmentSessionsRevision,
} from '@renderer/lib/environment-sessions'
import { settleBackground } from '@shared/background'
import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { isTasksTableQueryKey, tasksTableQueryKey } from './tasks-query-key'

/**
 * Tasks notification adapter.
 *
 * `tasks.changed` carries no scope, so the session that delivered it names the Environment.
 * Every live browser session is subscribed independently; a secondary notification can never
 * fall through to the primary daemon's cache.
 */

export type ApplyTasksNotificationOptions = {
  readonly queryClient: QueryClient
  readonly daemon: DaemonScope
  readonly environmentId: string | null
}

type TasksNotificationSession = Pick<LiveEnvironmentSession, 'connectionId' | 'environmentId'> & {
  readonly session: Pick<LiveEnvironmentSession['session'], 'start' | 'onChange'>
}

export function applyTasksNotification(
  notification: TasksChanged,
  options: ApplyTasksNotificationOptions,
): void {
  for (const identity of tasksNotificationEffects(notification, options.environmentId)) {
    settleBackground(
      options.queryClient.invalidateQueries({
        queryKey: tasksTableQueryKey(options.daemon, identity),
        exact: true,
      }),
      'notification',
    )
  }
  if (options.environmentId === null) {
    settleBackground(
      options.queryClient.invalidateQueries({ queryKey: [['environmentTasks']] }),
      'notification',
    )
  }
}

/**
 * Invalidate every Tasks table cache entry. Session recovery calls this: after a reconnect or
 * a replaced daemon, nothing this client holds about any Environment's table is proven, and
 * the per-Environment identity is not enough because the gap could have hidden a change on
 * any of them.
 */
export function invalidateAllTasks(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => isTasksTableQueryKey(query.queryKey),
  })
}

/** Attach the Tasks adapter to exactly the current live session set. */
export function subscribeTasksSessions(
  sessions: readonly TasksNotificationSession[],
  options: {
    readonly queryClient: QueryClient
    readonly host: string | null
    readonly version: string | null
  },
): () => void {
  const cleanups = sessions.flatMap((entry) => {
    // A live secondary entry always has an Environment id. If topology is changing while a
    // daemon identity is being announced, wait for the revision rather than routing to primary.
    if (entry.connectionId !== null && entry.environmentId === null) return []
    const environmentId = entry.connectionId === null ? null : entry.environmentId
    const notificationOptions: ApplyTasksNotificationOptions = {
      queryClient: options.queryClient,
      environmentId,
      daemon: daemonScopeForEnvironment(environmentId, {
        host: options.host,
        version: options.version,
      }),
    }
    entry.session.start()
    return [
      entry.session.onChange((change) => {
        if (change.kind !== 'tasks.changed') return
        applyTasksNotification({ kind: 'tasks.changed' }, notificationOptions)
      }),
    ]
  })
  return () => {
    for (const cleanup of cleanups) cleanup()
  }
}

/** Subscribe once to session change signals and apply Tasks notifications. */
export function useTasksNotificationSubscription(): void {
  const queryClient = useQueryClient()
  const daemon = useDaemonIdentity()
  const host = daemon.host
  const version = daemon.version
  const sessionRevision = useEnvironmentSessionsRevision()
  const sessions = useMemo(() => liveEnvironmentSessions(sessionRevision), [sessionRevision])

  useEffect(() => {
    return subscribeTasksSessions(sessions, { queryClient, host, version })
  }, [host, queryClient, sessions, version])
}
