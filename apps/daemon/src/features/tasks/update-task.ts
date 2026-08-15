import type {
  Task,
  TaskLink,
  TaskReferences,
  TasksChanges,
  TasksClock,
  TasksResult,
  TasksStore,
} from './tasks-capabilities'
import { normalizeLinks, normalizeTags, validateTitle } from './tasks-rules'

export type UpdateTaskInput = {
  taskId: string
  title?: string
  notes?: string
  status?: Task['status']
  tags?: readonly string[]
  references?: TaskReferences
  links?: readonly TaskLink[]
}

/** Edit a row in place. Attachments are create-time only and are never touched here. */
export function createUpdateTask(deps: {
  store: TasksStore
  clock: TasksClock
  changes: TasksChanges
}) {
  return async function updateTask(input: UpdateTaskInput): Promise<TasksResult<Task>> {
    let title: string | undefined
    if (input.title !== undefined) {
      const validated = validateTitle(input.title)
      if (!validated.ok) return validated
      title = validated.value
    }
    const now = deps.clock.now()

    const written = await deps.store.transact((current) => {
      const existing = current.find((task) => task.id === input.taskId)
      if (existing === undefined) {
        return { ok: false, error: { code: 'tasks.not-found', taskId: input.taskId } }
      }
      const next: Task = {
        ...existing,
        ...(title !== undefined ? { title } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.tags !== undefined ? { tags: normalizeTags(input.tags) } : {}),
        ...(input.references !== undefined ? { references: input.references } : {}),
        ...(input.links !== undefined ? { links: normalizeLinks(input.links) } : {}),
        updatedAt: now,
      }
      return {
        ok: true,
        value: {
          tasks: current.map((task) => (task.id === next.id ? next : task)),
          value: next,
        },
      }
    })
    if (!written.ok) return written

    deps.changes.publish({ type: 'tasks.changed' })
    return written
  }
}

export type UpdateTask = ReturnType<typeof createUpdateTask>
