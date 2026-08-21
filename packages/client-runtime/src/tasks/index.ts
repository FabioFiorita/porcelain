/**
 * Shared Tasks client semantics.
 *
 * Framework-neutral query identity, mutation consequences and target resolution, the
 * configurable-column vocabulary, cross-Environment row aggregation, the free-text filter, and
 * the statuses a board opens on. Web and mobile bind these to their transport and TanStack
 * Query layers.
 */

export { taskMatchesQuery } from './task-match'
export { OPEN_TASK_STATUSES, TASK_STATUS_LABELS } from './task-status'
export {
  availableTaskColumns,
  DEFAULT_HIDDEN_TASK_COLUMN_IDS,
  resolveHiddenTaskColumns,
  resolveTaskColumnOrder,
  TASK_COLUMN_IDS,
  TASK_COLUMN_LABELS,
  TASK_REQUIRED_COLUMN_IDS,
  type TaskColumnId,
} from './tasks-columns'
export {
  resolveTasksTarget,
  type TasksMissingTarget,
  type TasksMutation,
  type TasksMutationDefinition,
  type TasksMutationTarget,
  tasksMutations,
} from './tasks-mutations'
export { tasksNotificationEffects } from './tasks-notifications'
export {
  type TasksTableQuery,
  tasksTableQuery,
  tasksTableQuerySchema,
} from './tasks-queries'
export { aggregateTaskRows, type TaskRow, type TaskSource } from './tasks-rows'
export { sortTaskRows } from './tasks-sort'
