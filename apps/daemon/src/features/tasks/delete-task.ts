import type { TasksAttachments, TasksChanges, TasksResult, TasksStore } from './tasks-capabilities'

export type DeleteTaskInput = { taskId: string }

/** Remove a row and the attachment directory it owned; nothing else references those files. */
export function createDeleteTask(deps: {
  store: TasksStore
  attachments: TasksAttachments
  changes: TasksChanges
}) {
  return async function deleteTask(
    input: DeleteTaskInput,
  ): Promise<TasksResult<{ taskId: string }>> {
    const written = await deps.store.transact((current) => {
      if (!current.some((task) => task.id === input.taskId)) {
        return { ok: false, error: { code: 'tasks.not-found', taskId: input.taskId } }
      }
      return {
        ok: true,
        value: {
          tasks: current.filter((task) => task.id !== input.taskId),
          value: { taskId: input.taskId },
        },
      }
    })
    if (!written.ok) return written

    await deps.attachments.discard(input.taskId)
    deps.changes.publish({ type: 'tasks.changed' })
    return written
  }
}

export type DeleteTask = ReturnType<typeof createDeleteTask>
