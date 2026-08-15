import {
  type TasksTableQuery,
  tasksTableQuery,
  tasksTableQuerySchema,
} from '@porcelain/client-runtime/tasks'
import { type DaemonScope, daemonScopeSchema } from '@renderer/lib/daemon-scope'
import { z } from 'zod'

/**
 * Web React Query key for a Tasks table: the shared identity + the active daemon scope.
 * The only Tasks server-state key; procedure-name strings never appear here.
 */

const tasksTableQueryKeySchema = z.tuple([tasksTableQuerySchema, daemonScopeSchema])

export function tasksTableQueryKey(
  daemon: DaemonScope,
  tableQuery: TasksTableQuery,
): readonly [TasksTableQuery, DaemonScope] {
  return [tableQuery, { host: daemon.host, version: daemon.version }] as const
}

/** The table key for one Environment under the active daemon scope. */
export function tasksKeyForEnvironment(
  daemon: DaemonScope,
  environmentId: string | null,
): readonly [TasksTableQuery, DaemonScope] {
  return tasksTableQueryKey(daemon, tasksTableQuery(environmentId))
}

/** True when a React Query key is a Tasks table identity (any Environment / daemon). */
export function isTasksTableQueryKey(queryKey: readonly unknown[]): boolean {
  return tasksTableQueryKeySchema.safeParse(queryKey).success
}
