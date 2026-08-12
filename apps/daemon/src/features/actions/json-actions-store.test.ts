// @vitest-environment node
import { chmod, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  emptyActionsFileV1,
  parseActionsFileV1,
  serializeActionsFileV1,
} from '@porcelain/shared/actions-file'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import { ACTIONS_FILE_MAX_BYTES, createJsonActionsStore } from './json-actions-store'

vi.mock('../../project/git-exclude', () => ({
  ensureCompanionHidden: vi.fn(async () => undefined),
}))
vi.mock('../../review/review-watch', () => ({
  watchProjectCompanion: vi.fn(),
}))

const ID = 'action-aa'

describe('createJsonActionsStore', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty v1 for an absent file and does not create it on read', async () => {
    await withTemporaryDirectory('porcelain-actions-absent-', async (directory) => {
      const store = createJsonActionsStore()
      const result = await store.read(directory)
      expect(result).toEqual({ ok: true, value: emptyActionsFileV1() })
      expect(await readdir(directory)).toEqual([])
    })
  })

  it('round-trips a strict v1 document atomically', async () => {
    await withTemporaryDirectory('porcelain-actions-roundtrip-', async (directory) => {
      const store = createJsonActionsStore()
      const action = {
        id: ID,
        title: 'Ship',
        command: 'make ship',
        order: 1,
        createdAt: 1,
      }
      const written = await store.transact(directory, () => ({
        ok: true,
        value: {
          kind: 'create',
          file: { version: 1, actions: [action] },
          action,
        },
      }))
      expect(written.ok).toBe(true)

      const path = join(directory, '.porcelain', 'actions.json')
      const raw = await readFile(path, 'utf8')
      expect(raw).toBe(serializeActionsFileV1({ version: 1, actions: [action] }))
      expect(parseActionsFileV1(JSON.parse(raw)).actions).toHaveLength(1)

      const read = await store.read(directory)
      expect(read.ok).toBe(true)
      if (!read.ok) return
      expect(read.value.actions).toEqual([action])

      const tmpLeft = (await readdir(join(directory, '.porcelain'))).filter((name) =>
        name.startsWith('.tmp-'),
      )
      expect(tmpLeft).toEqual([])
    })
  })

  it('rejects top-level arrays and incompatible versions without deleting incompat files', async () => {
    await withTemporaryDirectory('porcelain-actions-array-', async (directory) => {
      await mkdir(join(directory, '.porcelain'), { recursive: true })
      const path = join(directory, '.porcelain', 'actions.json')
      await writeFile(path, JSON.stringify([{ id: 'a', title: 't', command: 'c' }]))

      const store = createJsonActionsStore()
      expect(await store.read(directory)).toEqual({
        ok: false,
        error: { code: 'actions.unavailable' },
      })
      const entries = await readdir(join(directory, '.porcelain'))
      expect(entries.some((name) => name.startsWith('actions.json.corrupt-'))).toBe(true)
    })

    await withTemporaryDirectory('porcelain-actions-incompat-', async (directory) => {
      await mkdir(join(directory, '.porcelain'), { recursive: true })
      const path = join(directory, '.porcelain', 'actions.json')
      await writeFile(path, `${JSON.stringify({ version: 99, actions: [] }, null, 2)}\n`)

      const store = createJsonActionsStore()
      expect(await store.read(directory)).toEqual({
        ok: false,
        error: { code: 'actions.unavailable' },
      })
      expect(await readFile(path, 'utf8')).toContain('"version": 99')
    })
  })

  it('backs up malformed content and reports unavailable', async () => {
    await withTemporaryDirectory('porcelain-actions-corrupt-', async (directory) => {
      await mkdir(join(directory, '.porcelain'), { recursive: true })
      const path = join(directory, '.porcelain', 'actions.json')
      await writeFile(path, '{not-json')

      const store = createJsonActionsStore()
      expect(await store.read(directory)).toEqual({
        ok: false,
        error: { code: 'actions.unavailable' },
      })
      const entries = await readdir(join(directory, '.porcelain'))
      expect(entries.some((name) => name.startsWith('actions.json.corrupt-'))).toBe(true)
    })
  })

  it('reports oversize without rewriting the source', async () => {
    await withTemporaryDirectory('porcelain-actions-large-', async (directory) => {
      await mkdir(join(directory, '.porcelain'), { recursive: true })
      const path = join(directory, '.porcelain', 'actions.json')
      const payload = 'x'.repeat(200)
      await writeFile(path, payload)
      const store = createJsonActionsStore({ maxBytes: 50 })
      expect(await store.read(directory)).toEqual({
        ok: false,
        error: { code: 'actions.unavailable' },
      })
      expect(await readFile(path, 'utf8')).toBe(payload)
      expect(ACTIONS_FILE_MAX_BYTES).toBeGreaterThan(50)
    })
  })

  it('serializes concurrent mutations on the same project', async () => {
    await withTemporaryDirectory('porcelain-actions-concurrent-', async (directory) => {
      const store = createJsonActionsStore()
      let counter = 0
      await Promise.all(
        Array.from({ length: 8 }, () =>
          store.transact(directory, (current) => {
            counter += 1
            const action = {
              id: `action-${counter}`,
              title: `Action ${counter}`,
              command: `echo ${counter}`,
              order: counter,
              createdAt: counter,
            }
            return {
              ok: true as const,
              value: {
                kind: 'create' as const,
                file: { version: 1 as const, actions: [...current.actions, action] },
                action,
              },
            }
          }),
        ),
      )
      const read = await store.read(directory)
      expect(read.ok).toBe(true)
      if (!read.ok) return
      expect(read.value.actions).toHaveLength(8)
    })
  })

  it('does not write when the change rejects', async () => {
    await withTemporaryDirectory('porcelain-actions-reject-', async (directory) => {
      const store = createJsonActionsStore()
      expect(
        await store.transact(directory, () => ({
          ok: false,
          error: { code: 'actions.not-found', actionId: ID },
        })),
      ).toEqual({
        ok: false,
        error: { code: 'actions.not-found', actionId: ID },
      })
      expect(await readdir(directory)).toEqual([])
    })
  })

  it('rejects relative project paths', async () => {
    const store = createJsonActionsStore()
    expect(await store.read('relative/path')).toEqual({
      ok: false,
      error: { code: 'actions.unavailable' },
    })
  })

  it('normalizes permission failures to actions.unavailable', async () => {
    await withTemporaryDirectory('porcelain-actions-perm-', async (directory) => {
      const porcelain = join(directory, '.porcelain')
      await mkdir(porcelain, { recursive: true })
      const path = join(porcelain, 'actions.json')
      await writeFile(path, serializeActionsFileV1({ version: 1, actions: [] }))
      await chmod(porcelain, 0o500)

      const store = createJsonActionsStore()
      const result = await store.transact(directory, (current) => ({
        ok: true,
        value: {
          kind: 'delete',
          file: current,
          actionId: ID,
        },
      }))
      expect(result).toEqual({ ok: false, error: { code: 'actions.unavailable' } })
      await chmod(porcelain, 0o700)
    })
  })
})
