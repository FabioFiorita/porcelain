import { taskSchema } from '@porcelain/contracts/tasks'
import { tasksIndexPath } from '@shared/tasks-porcelain'
import { z } from 'zod'
import {
  createStrictJsonDocument,
  type ReadStrictJsonDocument,
} from '../../project-data/strict-json-document'
import type { Task, TasksResult, TasksStore, TasksStoreResult } from './tasks-capabilities'

/** Soft size bound for tasks.json — large enough for a real table, small enough to fail closed. */
export const TASKS_INDEX_FILE_MAX_BYTES = 2 * 1024 * 1024

const tasksIndexValueSchema = z.object({ tasks: z.array(taskSchema) }).strict()
type TasksIndexValue = z.infer<typeof tasksIndexValueSchema>

function unavailable(): { ok: false; error: { code: 'tasks.unavailable' } } {
  return { ok: false, error: { code: 'tasks.unavailable' } }
}

function reportUnavailable(
  result: Exclude<ReadStrictJsonDocument<TasksIndexValue>, { kind: 'missing' | 'valid' }>,
): void {
  if (result.kind === 'corrupt') {
    console.error(`porcelain: tasks table is corrupt; backup at ${result.backupPath}`)
    return
  }
  if (result.kind === 'incompatible-version') {
    console.error(`porcelain: tasks table has unsupported version ${result.version}`)
    return
  }
  console.error(
    `porcelain: tasks table is ${result.byteLength} bytes (> ${TASKS_INDEX_FILE_MAX_BYTES})`,
  )
}

/**
 * The daemon-wide Tasks table: one strict JSON document under `$PORCELAIN_HOME/tasks/`,
 * written through the shared atomic temp+rename document (corruption backup, size bound,
 * fsync). Mutations are serialized in-process so a read-modify-write cannot interleave.
 */
export function createTasksStore(options: { homeDir: string }): TasksStore {
  const document = createStrictJsonDocument({
    path: tasksIndexPath(options.homeDir),
    valueSchema: tasksIndexValueSchema,
    maxBytes: TASKS_INDEX_FILE_MAX_BYTES,
  })

  // FIFO mutation chain: a failed transaction never blocks the next one.
  let chain: Promise<void> = Promise.resolve()

  async function read(): Promise<TasksStoreResult<Task[]>> {
    let result: ReadStrictJsonDocument<TasksIndexValue>
    try {
      result = await document.read()
    } catch {
      return unavailable()
    }
    if (result.kind === 'missing') return { ok: true, value: [] }
    if (result.kind !== 'valid') {
      reportUnavailable(result)
      return unavailable()
    }
    return { ok: true, value: result.value.tasks }
  }

  async function runTransaction<Value>(
    plan: (current: Task[]) => TasksResult<{ tasks: Task[]; value: Value }>,
  ): Promise<TasksResult<Value>> {
    const current = await read()
    if (!current.ok) return current
    const planned = plan(current.value)
    if (!planned.ok) return planned
    try {
      await document.write({ tasks: planned.value.tasks })
    } catch {
      return unavailable()
    }
    return { ok: true, value: planned.value.value }
  }

  return Object.freeze({
    read,
    transact<Value>(
      plan: (current: Task[]) => TasksResult<{ tasks: Task[]; value: Value }>,
    ): Promise<TasksResult<Value>> {
      const run = chain.then(() => runTransaction(plan))
      // The caller owns `run`'s rejection; this tail only keeps the FIFO chain alive.
      chain = Promise.allSettled([run]).then(() => undefined)
      return run
    },
  })
}
