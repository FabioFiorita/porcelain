import type { TasksChanged } from '@porcelain/contracts/tasks'
import { type TasksTableQuery, tasksTableQuery } from './tasks-queries'

/**
 * Exhaustive Tasks notification → query identity mapping.
 *
 * `tasks.changed` carries no scope, so the caller supplies the Environment whose session
 * delivered it: a notification proves that daemon's table is stale and says nothing about
 * any other Environment's.
 */
export function tasksNotificationEffects(
  notification: TasksChanged,
  environmentId: string | null = null,
): readonly TasksTableQuery[] {
  if (notification.kind !== 'tasks.changed') return []
  return [tasksTableQuery(environmentId)]
}
