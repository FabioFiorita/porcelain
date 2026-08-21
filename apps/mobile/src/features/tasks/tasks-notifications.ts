import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import { tasksNotificationEffects } from '@porcelain/client-runtime/tasks'
import type { TasksChanged } from '@porcelain/contracts/tasks'
import { settleBackground } from '@porcelain/shared/background'
import type { QueryClient } from '@tanstack/react-query'

import { invalidateAllTasksQueries, invalidateTasksIdentities } from './tasks-query-key'

/**
 * Mobile Tasks notification adapter.
 *
 * `tasks.changed` carries no scope — it says "this daemon's table is stale" and nothing about
 * any other daemon's — so the session that delivered it names the Environment.
 */

export type ApplyTasksNotificationOptions = {
  readonly queryClient: QueryClient
  readonly environmentId: string
}

export function applyTasksNotification(
  notification: TasksChanged,
  options: ApplyTasksNotificationOptions,
): void {
  settleBackground(
    invalidateTasksIdentities(
      options.queryClient,
      tasksNotificationEffects(notification, options.environmentId),
    ),
    'notification',
  )
}

/**
 * Recover after a sequence gap. Every Environment's table is refetched, not just the one that
 * reconnected: a gap hides changes, and this device holds tables for daemons whose sessions
 * were never part of the gap to report on.
 */
export function applyTasksFreshnessRequirement(
  _requirement: FreshnessRequirement,
  options: ApplyTasksNotificationOptions,
): void {
  settleBackground(invalidateAllTasksQueries(options.queryClient), 'notification')
}
