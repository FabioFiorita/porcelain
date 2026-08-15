import { tasksNotificationEffects } from '@porcelain/client-runtime/tasks'
import type { TasksChanged } from '@porcelain/contracts/tasks'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { primary } from '@renderer/lib/daemon'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { settleBackground } from '@shared/background'
import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { isTasksTableQueryKey, tasksTableQueryKey } from './tasks-query-key'

/**
 * Tasks notification adapter.
 *
 * `tasks.changed` carries no scope, so the session that delivered it names the Environment:
 * this window's own daemon. Rows from OTHER Environments are the shell's fan-out cache, and
 * they refresh on focus rather than on a notification — this client has no session with
 * those daemons, so it cannot be told when they change and must not pretend otherwise.
 */

function applyTasksNotification(
  notification: TasksChanged,
  options: { queryClient: QueryClient; daemon: DaemonScope },
): void {
  for (const identity of tasksNotificationEffects(notification, null)) {
    settleBackground(
      options.queryClient.invalidateQueries({
        queryKey: tasksTableQueryKey(options.daemon, identity),
        exact: true,
      }),
      'notification',
    )
  }
  settleBackground(
    options.queryClient.invalidateQueries({ queryKey: [['environmentTasks']] }),
    'notification',
  )
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

/** Subscribe once to session change signals and apply Tasks notifications. */
export function useTasksNotificationSubscription(): void {
  const queryClient = useQueryClient()
  const daemon = useDaemonIdentity()
  const host = daemon.host
  const version = daemon.version

  useEffect(() => {
    const daemonScope: DaemonScope = { host, version }
    return primary.onChange((change) => {
      if (change.kind !== 'tasks.changed') return
      applyTasksNotification({ kind: 'tasks.changed' }, { queryClient, daemon: daemonScope })
    })
  }, [queryClient, host, version])
}
