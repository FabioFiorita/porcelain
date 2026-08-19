/**
 * Shared Tasks client semantics.
 *
 * Framework-neutral query identity, mutation consequences and target resolution, the
 * configurable-column vocabulary, and cross-Environment row aggregation. Web (and a later
 * mobile client) bind these to their transport and TanStack Query layers.
 */

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
