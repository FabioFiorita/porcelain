import { randomUUID } from 'node:crypto'
import type { SessionChange } from '@porcelain/contracts/session'
import { createCreateTask } from './create-task'
import { createDeleteTask } from './delete-task'
import { createGetTaskAttachment } from './get-task-attachment'
import { createListTasks } from './list-tasks'
import type {
  TasksAttachments,
  TasksChanges,
  TasksClock,
  TasksIds,
  TasksStore,
} from './tasks-capabilities'
import { createTasksChangesPublisher } from './tasks-notifications'
import { createUpdateTask } from './update-task'

export type TasksOperations = {
  listTasks: ReturnType<typeof createListTasks>
  createTask: ReturnType<typeof createCreateTask>
  updateTask: ReturnType<typeof createUpdateTask>
  deleteTask: ReturnType<typeof createDeleteTask>
  getTaskAttachment: ReturnType<typeof createGetTaskAttachment>
}

/**
 * The store and the attachment adapter are injected, never constructed here: both are rooted
 * at `$PORCELAIN_HOME`, and the process entry point is the only place allowed to resolve it.
 */
export function createTasksOperations(options: {
  store: TasksStore
  attachments: TasksAttachments
  clock?: TasksClock
  ids?: TasksIds
  changes?: TasksChanges
  publishSessionChange?: (change: SessionChange) => void
}): TasksOperations {
  const { store, attachments } = options
  const clock = options.clock ?? { now: () => new Date().toISOString() }
  const ids = options.ids ?? { create: () => randomUUID() }
  const changes =
    options.changes ??
    createTasksChangesPublisher(options.publishSessionChange ?? (() => undefined))

  return Object.freeze({
    listTasks: createListTasks({ store }),
    createTask: createCreateTask({ store, clock, ids, attachments, changes }),
    updateTask: createUpdateTask({ store, clock, attachments, changes }),
    deleteTask: createDeleteTask({ store, attachments, changes }),
    getTaskAttachment: createGetTaskAttachment({ store, attachments }),
  })
}
