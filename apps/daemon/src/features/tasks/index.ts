/**
 * Tasks domain public surface for daemon composition.
 * Only the bound router and the operations factory are exported; adapters are
 * constructed at the composition root.
 */

export { createTasksAttachments } from './tasks-attachments'
export type {
  TasksAttachments,
  TasksChanges,
  TasksClock,
  TasksIds,
  TasksResult,
  TasksStore,
} from './tasks-capabilities'
export { createTasksOperations, type TasksOperations } from './tasks-operations'
export { createTasksRouter } from './tasks-router'
export { createTasksStore, TASKS_INDEX_FILE_MAX_BYTES } from './tasks-store'
