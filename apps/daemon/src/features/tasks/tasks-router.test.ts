// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { type Task, taskFixture } from '@porcelain/contracts/tasks'
import { callTRPCProcedure } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { normalizePublicError } from '../../daemon-composition/public-error'
import type { TasksOperations } from './tasks-operations'
import { createTasksRouter } from './tasks-router'

const REQUEST_ID = '00000000-0000-4000-8000-000000000019'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }
const ID = '00000000-0000-4000-8000-0000000005a1'

function expectPublicCode(error: unknown, code: string, details?: Record<string, unknown>) {
  const normalized = normalizePublicError(error, REQUEST_ID)
  expect(normalized.unexpected).toBe(false)
  const parsed = publicErrorSchema.parse(normalized.error)
  expect(parsed).toMatchObject({ code, requestId: REQUEST_ID })
  if (details !== undefined) expect(parsed).toMatchObject({ details })
}

async function rejected(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('Expected a tRPC rejection')
}

function unavailableOps(overrides: Partial<TasksOperations> = {}): TasksOperations {
  return {
    listTasks: async () => ({ ok: false, error: { code: 'tasks.unavailable' } }),
    createTask: async () => ({ ok: false, error: { code: 'tasks.unavailable' } }),
    updateTask: async () => ({ ok: false, error: { code: 'tasks.unavailable' } }),
    deleteTask: async () => ({ ok: false, error: { code: 'tasks.unavailable' } }),
    ...overrides,
  }
}

function task(overrides: Partial<Task> = {}): Task {
  return taskFixture({ id: ID, ...overrides })
}

describe('tasks feature router (canonical wire names)', () => {
  it('answers listTasks from the operation with the authoritative rows', async () => {
    const calls: number[] = []
    const router = createTasksRouter(
      unavailableOps({
        listTasks: async () => {
          calls.push(1)
          return { ok: true, value: [task()] }
        },
      }),
    )

    await expect(router.createCaller(PUBLIC_CONTEXT).listTasks()).resolves.toEqual([task()])
    expect(calls).toHaveLength(1)
  })

  it('maps createTask input onto the operation and returns the authoritative task', async () => {
    const calls: unknown[] = []
    const router = createTasksRouter(
      unavailableOps({
        createTask: async (input) => {
          calls.push(input)
          return { ok: true, value: task({ title: 'Capture the follow-up', tags: ['follow-up'] }) }
        },
      }),
    )

    await expect(
      router.createCaller(PUBLIC_CONTEXT).createTask({
        title: '  Capture the follow-up  ',
        tags: ['follow-up'],
        attachmentPaths: ['/abs/trace.log'],
      }),
    ).resolves.toMatchObject({ id: ID, title: 'Capture the follow-up' })
    expect(calls).toEqual([
      {
        title: 'Capture the follow-up',
        notes: undefined,
        status: undefined,
        tags: ['follow-up'],
        references: undefined,
        links: undefined,
        attachmentPaths: ['/abs/trace.log'],
      },
    ])
  })

  it('maps updateTask input onto the operation and returns the authoritative task', async () => {
    const calls: unknown[] = []
    const router = createTasksRouter(
      unavailableOps({
        updateTask: async (input) => {
          calls.push(input)
          return { ok: true, value: task({ status: 'done' }) }
        },
      }),
    )

    await expect(
      router.createCaller(PUBLIC_CONTEXT).updateTask({ taskId: ID, status: 'done' }),
    ).resolves.toMatchObject({ id: ID, status: 'done' })
    expect(calls).toEqual([
      {
        taskId: ID,
        title: undefined,
        notes: undefined,
        status: 'done',
        tags: undefined,
        references: undefined,
        links: undefined,
      },
    ])
  })

  it('maps deleteTask input onto the operation and returns the deleted id', async () => {
    const calls: unknown[] = []
    const router = createTasksRouter(
      unavailableOps({
        deleteTask: async (input) => {
          calls.push(input)
          return { ok: true, value: { taskId: ID } }
        },
      }),
    )

    await expect(router.createCaller(PUBLIC_CONTEXT).deleteTask({ taskId: ID })).resolves.toEqual({
      taskId: ID,
    })
    expect(calls).toEqual([{ taskId: ID }])
  })

  it('surfaces tasks.not-found with the task id in its details', async () => {
    const router = createTasksRouter(
      unavailableOps({
        updateTask: async () => ({ ok: false, error: { code: 'tasks.not-found', taskId: ID } }),
      }),
    )

    expectPublicCode(
      await rejected(() =>
        router.createCaller(PUBLIC_CONTEXT).updateTask({ taskId: ID, status: 'done' }),
      ),
      'tasks.not-found',
      { taskId: ID },
    )
  })

  it('surfaces tasks.invalid-title with its reason and bound', async () => {
    const router = createTasksRouter(
      unavailableOps({
        createTask: async () => ({
          ok: false,
          error: { code: 'tasks.invalid-title', reason: 'too-long', maxLength: 240 },
        }),
      }),
    )

    expectPublicCode(
      await rejected(() => router.createCaller(PUBLIC_CONTEXT).createTask({ title: 'x' })),
      'tasks.invalid-title',
      { reason: 'too-long', maxLength: 240 },
    )
  })

  it('surfaces tasks.attachment-rejected with its reason', async () => {
    const router = createTasksRouter(
      unavailableOps({
        createTask: async () => ({
          ok: false,
          error: { code: 'tasks.attachment-rejected', reason: 'too-large' },
        }),
      }),
    )

    expectPublicCode(
      await rejected(() =>
        router.createCaller(PUBLIC_CONTEXT).createTask({
          title: 'x',
          attachmentPaths: ['/abs/big.bin'],
        }),
      ),
      'tasks.attachment-rejected',
      { reason: 'too-large' },
    )
  })

  it('surfaces tasks.unavailable from every procedure', async () => {
    const caller = createTasksRouter(unavailableOps()).createCaller(PUBLIC_CONTEXT)

    expectPublicCode(await rejected(() => caller.listTasks()), 'tasks.unavailable')
    expectPublicCode(await rejected(() => caller.createTask({ title: 'x' })), 'tasks.unavailable')
    expectPublicCode(
      await rejected(() => caller.updateTask({ taskId: ID, status: 'done' })),
      'tasks.unavailable',
    )
    expectPublicCode(await rejected(() => caller.deleteTask({ taskId: ID })), 'tasks.unavailable')
  })

  it('rejects contract-invalid raw input before invoking an operation', async () => {
    let called = false
    const router = createTasksRouter(
      unavailableOps({
        createTask: async () => {
          called = true
          return { ok: false, error: { code: 'tasks.unavailable' } }
        },
      }),
    )

    const error = await rejected(() =>
      callTRPCProcedure({
        router,
        path: 'createTask',
        type: 'mutation',
        ctx: PUBLIC_CONTEXT,
        getRawInput: async () => ({ title: '' }),
        signal: undefined,
        batchIndex: 0,
      }),
    )
    expectPublicCode(error, 'request.invalid')
    expect(called).toBe(false)
  })

  it('redacts an unexpected operation throw through the public boundary', async () => {
    const router = createTasksRouter(
      unavailableOps({
        listTasks: async () => {
          throw new Error('secret path /home/user/secret')
        },
      }),
    )

    const error = await rejected(() => router.createCaller(PUBLIC_CONTEXT).listTasks())
    const normalized = normalizePublicError(error, REQUEST_ID)
    expect(normalized.unexpected).toBe(true)
    expect(publicErrorSchema.parse(normalized.error).code).toBe('internal.unexpected')
    expect(JSON.stringify(normalized.error)).not.toContain('/home/user/secret')
  })
})
