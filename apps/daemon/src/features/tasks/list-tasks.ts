import type { Task, TasksResult, TasksStore } from './tasks-capabilities'
import { sortTasks } from './tasks-rules'

export function createListTasks(deps: { store: TasksStore }) {
  return async function listTasks(): Promise<TasksResult<Task[]>> {
    const read = await deps.store.read()
    if (!read.ok) return read
    return { ok: true, value: sortTasks(read.value) }
  }
}

export type ListTasks = ReturnType<typeof createListTasks>
