// @vitest-environment node
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { type Task, taskFixture } from '@porcelain/contracts/tasks'
import { tasksIndexPath } from '@shared/tasks-porcelain'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import { createTasksStore } from './tasks-store'

const ID_A = '00000000-0000-4000-8000-0000000002a1'
const ID_B = '00000000-0000-4000-8000-0000000002b2'

function task(id: string, overrides: Partial<Task> = {}): Task {
  return taskFixture({ id, ...overrides })
}

async function writeIndexRaw(homeDir: string, body: string): Promise<string> {
  const path = tasksIndexPath(homeDir)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, body, 'utf8')
  return path
}

describe('createTasksStore', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads an absent table as empty and does not create the file', async () => {
    await withTemporaryDirectory('porcelain-tasks-store-absent-', async (homeDir) => {
      const store = createTasksStore({ homeDir })

      expect(await store.read()).toEqual({ ok: true, value: [] })
      expect(await readdir(homeDir)).toEqual([])
    })
  })

  it('round-trips tasks through the home directory for a fresh store instance', async () => {
    await withTemporaryDirectory('porcelain-tasks-store-roundtrip-', async (homeDir) => {
      const written = await createTasksStore({ homeDir }).transact((current) => ({
        ok: true,
        value: { tasks: [...current, task(ID_A, { title: 'Ship the table' })], value: 'stored' },
      }))
      expect(written).toEqual({ ok: true, value: 'stored' })

      const reread = await createTasksStore({ homeDir }).read()
      expect(reread).toEqual({ ok: true, value: [task(ID_A, { title: 'Ship the table' })] })

      const raw = JSON.parse(await readFile(tasksIndexPath(homeDir), 'utf8')) as unknown
      expect(raw).toEqual({
        version: 1,
        value: { tasks: [task(ID_A, { title: 'Ship the table' })] },
      })
    })
  })

  it('reports a corrupt table as unavailable, keeping the bytes in a backup', async () => {
    await withTemporaryDirectory('porcelain-tasks-store-corrupt-', async (homeDir) => {
      const errors: string[] = []
      vi.spyOn(console, 'error').mockImplementation((message: unknown) => {
        errors.push(String(message))
      })
      const path = await writeIndexRaw(homeDir, '{ this is not json')

      const store = createTasksStore({ homeDir })
      expect(await store.read()).toEqual({ ok: false, error: { code: 'tasks.unavailable' } })

      const entries = await readdir(dirname(path))
      const backups = entries.filter((name) => name.startsWith('tasks.json.corrupt-'))
      expect(backups).toHaveLength(1)
      expect(entries).not.toContain('tasks.json')
      expect(await readFile(`${dirname(path)}/${backups[0]}`, 'utf8')).toBe('{ this is not json')
      expect(errors.join('\n')).toContain('tasks table is corrupt')
    })
  })

  it('reports a schema-invalid row as unavailable and keeps the rejected bytes', async () => {
    await withTemporaryDirectory('porcelain-tasks-store-schema-', async (homeDir) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const body = `${JSON.stringify({ version: 1, value: { tasks: [{ id: 'not-a-uuid' }] } })}\n`
      const path = await writeIndexRaw(homeDir, body)

      expect(await createTasksStore({ homeDir }).read()).toEqual({
        ok: false,
        error: { code: 'tasks.unavailable' },
      })

      const backups = (await readdir(dirname(path))).filter((name) =>
        name.startsWith('tasks.json.corrupt-'),
      )
      expect(backups).toHaveLength(1)
      expect(await readFile(`${dirname(path)}/${backups[0]}`, 'utf8')).toBe(body)
    })
  })

  it('refuses a future format version as unavailable without moving the file', async () => {
    await withTemporaryDirectory('porcelain-tasks-store-version-', async (homeDir) => {
      const errors: string[] = []
      vi.spyOn(console, 'error').mockImplementation((message: unknown) => {
        errors.push(String(message))
      })
      const body = `${JSON.stringify({ version: 99, value: { tasks: [] } })}\n`
      const path = await writeIndexRaw(homeDir, body)

      const store = createTasksStore({ homeDir })
      expect(await store.read()).toEqual({ ok: false, error: { code: 'tasks.unavailable' } })
      expect(
        await store.transact(() => ({ ok: true, value: { tasks: [], value: 'never' } })),
      ).toEqual({ ok: false, error: { code: 'tasks.unavailable' } })

      expect(await readFile(path, 'utf8')).toBe(body)
      expect(errors.join('\n')).toContain('unsupported version 99')
    })
  })

  it('serializes concurrent transacts so neither append is lost', async () => {
    await withTemporaryDirectory('porcelain-tasks-store-concurrent-', async (homeDir) => {
      const store = createTasksStore({ homeDir })

      const [first, second] = await Promise.all([
        store.transact((current) => ({
          ok: true,
          value: { tasks: [...current, task(ID_A)], value: ID_A },
        })),
        store.transact((current) => ({
          ok: true,
          value: { tasks: [...current, task(ID_B)], value: ID_B },
        })),
      ])
      expect([first, second]).toEqual([
        { ok: true, value: ID_A },
        { ok: true, value: ID_B },
      ])

      const read = await store.read()
      expect(read.ok).toBe(true)
      if (!read.ok) return
      expect(read.value.map((row) => row.id).sort()).toEqual([ID_A, ID_B])
    })
  })

  it('leaves the file untouched when the plan rejects', async () => {
    await withTemporaryDirectory('porcelain-tasks-store-reject-', async (homeDir) => {
      const store = createTasksStore({ homeDir })
      await store.transact((current) => ({
        ok: true,
        value: { tasks: [...current, task(ID_A)], value: null },
      }))
      const before = await readFile(tasksIndexPath(homeDir), 'utf8')

      const rejected = await store.transact(() => ({
        ok: false,
        error: { code: 'tasks.not-found', taskId: ID_B },
      }))
      expect(rejected).toEqual({
        ok: false,
        error: { code: 'tasks.not-found', taskId: ID_B },
      })

      expect(await readFile(tasksIndexPath(homeDir), 'utf8')).toBe(before)
      expect(await store.read()).toEqual({ ok: true, value: [task(ID_A)] })
    })
  })
})
