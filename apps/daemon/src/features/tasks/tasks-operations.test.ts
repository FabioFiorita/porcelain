// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type {
  Task,
  TaskAttachment,
  TasksAttachments,
  TasksChanges,
  TasksResult,
  TasksStore,
} from './tasks-capabilities'
import { createTasksOperations, type TasksOperations } from './tasks-operations'

const ID_A = '00000000-0000-4000-8000-0000000004a1'
const ID_B = '00000000-0000-4000-8000-0000000004b2'
const ID_C = '00000000-0000-4000-8000-0000000004c3'
const ATTACHMENT_ID = '00000000-0000-4000-8000-0000000004d4'
const CREATED_AT = '2026-01-01T00:00:00.000Z'

function row(overrides: Partial<Task> & { id: string }): Task {
  return {
    shortId: 'T-1',
    title: 'Existing row',
    status: 'todo',
    tags: [],
    references: {},
    pathRefs: [],
    attachments: [],
    links: [],
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  }
}

type MemoryStore = {
  store: TasksStore
  rows: () => Task[]
  writes: () => number
  reads: () => number
}

function memoryStore(initial: Task[] = []): MemoryStore {
  let rows = initial.map((task) => structuredClone(task))
  let writes = 0
  let reads = 0

  const store: TasksStore = {
    async read() {
      reads += 1
      return { ok: true, value: rows.map((task) => structuredClone(task)) }
    },
    async transact(plan) {
      reads += 1
      const planned = plan(rows.map((task) => structuredClone(task)))
      if (!planned.ok) return planned
      writes += 1
      rows = planned.value.tasks.map((task) => structuredClone(task))
      return { ok: true, value: planned.value.value }
    },
  }

  return {
    store,
    rows: () => rows.map((task) => structuredClone(task)),
    writes: () => writes,
    reads: () => reads,
  }
}

function unavailableStore(): MemoryStore {
  let reads = 0
  const store: TasksStore = {
    async read() {
      reads += 1
      return { ok: false, error: { code: 'tasks.unavailable' } }
    },
    async transact() {
      reads += 1
      return { ok: false, error: { code: 'tasks.unavailable' } }
    },
  }
  return { store, rows: () => [], writes: () => 0, reads: () => reads }
}

type MemoryAttachments = {
  attachments: TasksAttachments
  stored: () => Record<string, string[]>
}

/**
 * Attachment adapter that keeps the names it accepted per task, so a discard is observed as
 * the files no longer being in the store rather than as a call having happened.
 */
function memoryAttachments(options: { failAfter?: number } = {}): MemoryAttachments {
  const files = new Map<string, string[]>()
  let accepted = 0

  const attachments: TasksAttachments = {
    async copyInto(taskId, sourcePath): Promise<TasksResult<TaskAttachment>> {
      if (options.failAfter !== undefined && accepted >= options.failAfter) {
        return { ok: false, error: { code: 'tasks.attachment-rejected', reason: 'not-found' } }
      }
      accepted += 1
      const name = sourcePath.slice(sourcePath.lastIndexOf('/') + 1)
      files.set(taskId, [...(files.get(taskId) ?? []), name])
      return {
        ok: true,
        value: {
          id: ATTACHMENT_ID,
          name,
          storedPath: `${taskId}/${ATTACHMENT_ID}-${name}`,
          byteSize: 4,
          mime: 'text/plain',
        },
      }
    },
    async writeBytes(taskId, name): Promise<TasksResult<TaskAttachment>> {
      accepted += 1
      files.set(taskId, [...(files.get(taskId) ?? []), name])
      return {
        ok: true,
        value: {
          id: ATTACHMENT_ID,
          name,
          storedPath: `${taskId}/${ATTACHMENT_ID}-${name}`,
          byteSize: 4,
          mime: 'image/png',
        },
      }
    },
    async read() {
      return { ok: true, value: new Uint8Array([1, 2, 3, 4]) }
    },
    async removeOne() {
      return
    },
    async discard(taskId) {
      files.delete(taskId)
    },
  }

  return {
    attachments,
    stored: () => Object.fromEntries([...files.entries()].map(([key, value]) => [key, [...value]])),
  }
}

function recordingChanges(): { changes: TasksChanges; events: string[] } {
  const events: string[] = []
  return {
    events,
    changes: {
      publish(change) {
        events.push(change.type)
      },
    },
  }
}

function operationsFor(options: {
  store: TasksStore
  attachments: TasksAttachments
  changes: TasksChanges
  ids?: string[]
  times?: string[]
}): TasksOperations {
  const ids = [...(options.ids ?? [ID_A, ID_B, ID_C])]
  const times = [...(options.times ?? ['2026-02-01T00:00:00.000Z'])]
  return createTasksOperations({
    store: options.store,
    attachments: options.attachments,
    changes: options.changes,
    ids: { create: () => ids.shift() ?? ID_C },
    clock: { now: () => (times.length > 1 ? times.shift() : times[0]) ?? CREATED_AT },
  })
}

describe('tasks operations', () => {
  it('creates a task with a trimmed title, default status, and de-duplicated tags', async () => {
    const memory = memoryStore()
    const files = memoryAttachments()
    const { changes, events } = recordingChanges()
    const ops = operationsFor({
      store: memory.store,
      attachments: files.attachments,
      changes,
      times: ['2026-02-01T00:00:00.000Z'],
    })

    const created = await ops.createTask({
      title: '  Capture the follow-up  ',
      tags: [' git ', 'git', '', 'flaky'],
      links: [{ url: 'https://example.invalid/1', label: '  Failing run ' }],
    })

    expect(created).toEqual({
      ok: true,
      value: {
        id: ID_A,
        shortId: 'T-1',
        title: 'Capture the follow-up',
        status: 'todo',
        tags: ['git', 'flaky'],
        references: {},
        pathRefs: [],
        attachments: [],
        links: [{ url: 'https://example.invalid/1', label: 'Failing run' }],
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
      },
    })
    expect(memory.rows().map((task) => task.id)).toEqual([ID_A])
    expect(events).toEqual(['tasks.changed'])
  })

  it('aborts a create whose second attachment is rejected and leaves nothing behind', async () => {
    const memory = memoryStore()
    const files = memoryAttachments({ failAfter: 1 })
    const { changes, events } = recordingChanges()
    const ops = operationsFor({ store: memory.store, attachments: files.attachments, changes })

    const created = await ops.createTask({
      title: 'Two attachments',
      attachmentPaths: ['/abs/first.txt', '/abs/second.txt'],
    })

    expect(created).toEqual({
      ok: false,
      error: { code: 'tasks.attachment-rejected', reason: 'not-found' },
    })
    expect(files.stored()).toEqual({})
    expect(memory.rows()).toEqual([])
    expect(memory.writes()).toBe(0)
    expect(events).toEqual([])
  })

  it('discards copied attachments when the durable write fails', async () => {
    const failing = unavailableStore()
    const files = memoryAttachments()
    const { changes, events } = recordingChanges()
    const ops = operationsFor({ store: failing.store, attachments: files.attachments, changes })

    const created = await ops.createTask({
      title: 'Doomed',
      attachmentPaths: ['/abs/first.txt'],
    })

    expect(created).toEqual({ ok: false, error: { code: 'tasks.unavailable' } })
    expect(files.stored()).toEqual({})
    expect(events).toEqual([])
  })

  it('rejects a blank or over-long title without reaching the store', async () => {
    const memory = memoryStore()
    const files = memoryAttachments()
    const { changes, events } = recordingChanges()
    const ops = operationsFor({ store: memory.store, attachments: files.attachments, changes })

    expect(await ops.createTask({ title: '   ' })).toEqual({
      ok: false,
      error: { code: 'tasks.invalid-title', reason: 'blank', maxLength: 240 },
    })
    expect(await ops.createTask({ title: 'x'.repeat(241) })).toEqual({
      ok: false,
      error: { code: 'tasks.invalid-title', reason: 'too-long', maxLength: 240 },
    })
    const created = await ops.createTask({
      title: 'x'.repeat(240),
      pathRefs: [
        {
          projectId: 'project-synthetic',
          worktreeId: 'worktree-synthetic',
          path: 'src/app.ts',
          kind: 'file',
        },
      ],
      attachmentUploads: [
        { name: 'shot.png', contentBase64: Buffer.from('PNG').toString('base64') },
      ],
    })
    expect(created).toMatchObject({
      ok: true,
      value: { shortId: 'T-1', pathRefs: [{ path: 'src/app.ts', kind: 'file' }] },
    })
    if (created.ok) {
      expect(created.value.attachments).toHaveLength(1)
      expect(created.value.attachments[0]?.name).toBe('shot.png')
    }

    expect(memory.reads()).toBe(1)
    expect(memory.writes()).toBe(1)
    expect(events).toEqual(['tasks.changed'])
  })

  it('updates only the named fields and bumps updatedAt', async () => {
    const memory = memoryStore([
      row({ id: ID_A, title: 'Before', notes: 'keep me', tags: ['old'], status: 'todo' }),
    ])
    const files = memoryAttachments()
    const { changes, events } = recordingChanges()
    const ops = operationsFor({
      store: memory.store,
      attachments: files.attachments,
      changes,
      times: ['2026-03-01T00:00:00.000Z'],
    })

    const updated = await ops.updateTask({ taskId: ID_A, status: 'doing', tags: [' new ', 'new'] })

    expect(updated).toEqual({
      ok: true,
      value: {
        id: ID_A,
        shortId: 'T-1',
        title: 'Before',
        notes: 'keep me',
        status: 'doing',
        tags: ['new'],
        references: {},
        pathRefs: [],
        attachments: [],
        links: [],
        createdAt: CREATED_AT,
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    })
    expect(memory.rows()[0]?.updatedAt).toBe('2026-03-01T00:00:00.000Z')
    expect(events).toEqual(['tasks.changed'])
  })

  it('reports tasks.not-found for an unknown update and publishes nothing', async () => {
    const memory = memoryStore([row({ id: ID_A })])
    const files = memoryAttachments()
    const { changes, events } = recordingChanges()
    const ops = operationsFor({ store: memory.store, attachments: files.attachments, changes })

    expect(await ops.updateTask({ taskId: ID_B, title: 'Nope' })).toEqual({
      ok: false,
      error: { code: 'tasks.not-found', taskId: ID_B },
    })
    expect(memory.rows()).toEqual([row({ id: ID_A })])
    expect(memory.writes()).toBe(0)
    expect(events).toEqual([])
  })

  it('rejects an invalid update title before touching the store', async () => {
    const memory = memoryStore([row({ id: ID_A })])
    const files = memoryAttachments()
    const { changes } = recordingChanges()
    const ops = operationsFor({ store: memory.store, attachments: files.attachments, changes })

    expect(await ops.updateTask({ taskId: ID_A, title: ' ' })).toEqual({
      ok: false,
      error: { code: 'tasks.invalid-title', reason: 'blank', maxLength: 240 },
    })
    expect(memory.reads()).toBe(0)
  })

  it('deletes a row and the attachments it owned', async () => {
    const memory = memoryStore([row({ id: ID_A }), row({ id: ID_B })])
    const files = memoryAttachments()
    const { changes, events } = recordingChanges()
    const ops = operationsFor({ store: memory.store, attachments: files.attachments, changes })
    await files.attachments.copyInto(ID_A, '/abs/kept.txt')
    await files.attachments.copyInto(ID_B, '/abs/dropped.txt')

    expect(await ops.deleteTask({ taskId: ID_B })).toEqual({ ok: true, value: { taskId: ID_B } })

    expect(memory.rows().map((task) => task.id)).toEqual([ID_A])
    expect(files.stored()).toEqual({ [ID_A]: ['kept.txt'] })
    expect(events).toEqual(['tasks.changed'])
  })

  it('reports tasks.not-found for an unknown delete and keeps the attachments', async () => {
    const memory = memoryStore([row({ id: ID_A })])
    const files = memoryAttachments()
    const { changes, events } = recordingChanges()
    const ops = operationsFor({ store: memory.store, attachments: files.attachments, changes })
    await files.attachments.copyInto(ID_B, '/abs/orphan.txt')

    expect(await ops.deleteTask({ taskId: ID_B })).toEqual({
      ok: false,
      error: { code: 'tasks.not-found', taskId: ID_B },
    })
    expect(files.stored()).toEqual({ [ID_B]: ['orphan.txt'] })
    expect(events).toEqual([])
  })

  it('lists newest-updated first with ties broken by id', async () => {
    const memory = memoryStore([
      row({ id: ID_B, updatedAt: '2026-01-02T00:00:00.000Z' }),
      row({ id: ID_C, updatedAt: '2026-01-03T00:00:00.000Z' }),
      row({ id: ID_A, updatedAt: '2026-01-03T00:00:00.000Z' }),
    ])
    const files = memoryAttachments()
    const { changes } = recordingChanges()
    const ops = operationsFor({ store: memory.store, attachments: files.attachments, changes })

    const listed = await ops.listTasks()
    expect(listed.ok).toBe(true)
    if (!listed.ok) return
    expect(listed.value.map((task) => task.id)).toEqual([ID_A, ID_C, ID_B])
  })

  it('serves a stored attachment as a data URL', async () => {
    const memory = memoryStore([
      row({
        id: ID_A,
        attachments: [
          {
            id: ATTACHMENT_ID,
            name: 'shot.png',
            storedPath: `${ID_A}/${ATTACHMENT_ID}-shot.png`,
            byteSize: 4,
            mime: 'image/png',
          },
        ],
      }),
    ])
    const files = memoryAttachments()
    const { changes } = recordingChanges()
    const ops = operationsFor({ store: memory.store, attachments: files.attachments, changes })

    const served = await ops.getTaskAttachment({ taskId: ID_A, attachmentId: ATTACHMENT_ID })
    expect(served).toEqual({
      ok: true,
      value: {
        id: ATTACHMENT_ID,
        name: 'shot.png',
        mime: 'image/png',
        byteSize: 4,
        dataUrl: 'data:image/png;base64,AQIDBA==',
      },
    })
  })

  it('surfaces tasks.unavailable from every operation when the store fails', async () => {
    const failing = unavailableStore()
    const files = memoryAttachments()
    const { changes, events } = recordingChanges()
    const ops = operationsFor({ store: failing.store, attachments: files.attachments, changes })
    const unavailable = { ok: false, error: { code: 'tasks.unavailable' } }

    expect(await ops.listTasks()).toEqual(unavailable)
    expect(await ops.createTask({ title: 'Ship' })).toEqual(unavailable)
    expect(await ops.updateTask({ taskId: ID_A, status: 'done' })).toEqual(unavailable)
    expect(await ops.deleteTask({ taskId: ID_A })).toEqual(unavailable)
    expect(
      await ops.getTaskAttachment({
        taskId: ID_A,
        attachmentId: ATTACHMENT_ID,
      }),
    ).toEqual(unavailable)
    expect(events).toEqual([])
  })
})
