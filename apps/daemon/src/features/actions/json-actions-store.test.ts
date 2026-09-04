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

const ID = 'action-aa'
const PROJECT = 'proj-alpha'

/** `<homeDir>/projects/<projectId>/` — the daemon-root Project store. */
function projectDir(homeDir: string): string {
  return join(homeDir, 'projects', PROJECT)
}

function storePath(homeDir: string): string {
  return join(projectDir(homeDir), 'actions.json')
}

async function seed(homeDir: string, body: string): Promise<string> {
  await mkdir(projectDir(homeDir), { recursive: true })
  const path = storePath(homeDir)
  await writeFile(path, body)
  return path
}

describe('createJsonActionsStore', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty v1 for an absent file and does not create it on read', async () => {
    await withTemporaryDirectory('porcelain-actions-absent-', async (homeDir) => {
      const store = createJsonActionsStore({ homeDir })
      const result = await store.read(PROJECT)
      expect(result).toEqual({ ok: true, value: emptyActionsFileV1() })
      expect(await readdir(homeDir)).toEqual([])
    })
  })

  it('round-trips a strict v1 document atomically under the Project store', async () => {
    await withTemporaryDirectory('porcelain-actions-roundtrip-', async (homeDir) => {
      const store = createJsonActionsStore({ homeDir })
      const action = {
        id: ID,
        title: 'Ship',
        command: 'make ship',
        order: 1,
        createdAt: 1,
      }
      const written = await store.transact(PROJECT, () => ({
        ok: true,
        value: {
          kind: 'create',
          file: { version: 1, actions: [action] },
          action,
        },
      }))
      expect(written.ok).toBe(true)

      const raw = await readFile(storePath(homeDir), 'utf8')
      expect(raw).toBe(serializeActionsFileV1({ version: 1, actions: [action] }))
      expect(parseActionsFileV1(JSON.parse(raw)).actions).toHaveLength(1)

      const read = await store.read(PROJECT)
      expect(read.ok).toBe(true)
      if (!read.ok) return
      expect(read.value.actions).toEqual([action])

      const tmpLeft = (await readdir(projectDir(homeDir))).filter((name) =>
        name.startsWith('.tmp-'),
      )
      expect(tmpLeft).toEqual([])
    })
  })

  it('keeps two Projects in separate documents', async () => {
    await withTemporaryDirectory('porcelain-actions-scoped-', async (homeDir) => {
      const store = createJsonActionsStore({ homeDir })
      const action = { id: ID, title: 'Ship', command: 'make ship', order: 1, createdAt: 1 }
      await store.transact(PROJECT, () => ({
        ok: true,
        value: { kind: 'create', file: { version: 1, actions: [action] }, action },
      }))

      const other = await store.read('proj-beta')
      expect(other).toEqual({ ok: true, value: emptyActionsFileV1() })
    })
  })

  it('rejects top-level arrays and incompatible versions without deleting incompat files', async () => {
    await withTemporaryDirectory('porcelain-actions-array-', async (homeDir) => {
      await seed(homeDir, JSON.stringify([{ id: 'a', title: 't', command: 'c' }]))

      const store = createJsonActionsStore({ homeDir })
      expect(await store.read(PROJECT)).toEqual({
        ok: false,
        error: { code: 'actions.unavailable' },
      })
      const entries = await readdir(projectDir(homeDir))
      expect(entries.some((name) => name.startsWith('actions.json.corrupt-'))).toBe(true)
    })

    await withTemporaryDirectory('porcelain-actions-incompat-', async (homeDir) => {
      const path = await seed(homeDir, `${JSON.stringify({ version: 99, actions: [] }, null, 2)}\n`)

      const store = createJsonActionsStore({ homeDir })
      expect(await store.read(PROJECT)).toEqual({
        ok: false,
        error: { code: 'actions.unavailable' },
      })
      expect(await readFile(path, 'utf8')).toContain('"version": 99')
    })
  })

  it('backs up malformed content and reports unavailable', async () => {
    await withTemporaryDirectory('porcelain-actions-corrupt-', async (homeDir) => {
      await seed(homeDir, '{not-json')

      const store = createJsonActionsStore({ homeDir })
      expect(await store.read(PROJECT)).toEqual({
        ok: false,
        error: { code: 'actions.unavailable' },
      })
      const entries = await readdir(projectDir(homeDir))
      expect(entries.some((name) => name.startsWith('actions.json.corrupt-'))).toBe(true)
    })
  })

  it('reports oversize without rewriting the source', async () => {
    await withTemporaryDirectory('porcelain-actions-large-', async (homeDir) => {
      const payload = 'x'.repeat(200)
      const path = await seed(homeDir, payload)
      const store = createJsonActionsStore({ homeDir, maxBytes: 50 })
      expect(await store.read(PROJECT)).toEqual({
        ok: false,
        error: { code: 'actions.unavailable' },
      })
      expect(await readFile(path, 'utf8')).toBe(payload)
      expect(ACTIONS_FILE_MAX_BYTES).toBeGreaterThan(50)
    })
  })

  it('serializes concurrent mutations on the same project', async () => {
    await withTemporaryDirectory('porcelain-actions-concurrent-', async (homeDir) => {
      const store = createJsonActionsStore({ homeDir })
      let counter = 0
      await Promise.all(
        Array.from({ length: 8 }, () =>
          store.transact(PROJECT, (current) => {
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
      const read = await store.read(PROJECT)
      expect(read.ok).toBe(true)
      if (!read.ok) return
      expect(read.value.actions).toHaveLength(8)
    })
  })

  it('does not write when the change rejects', async () => {
    await withTemporaryDirectory('porcelain-actions-reject-', async (homeDir) => {
      const store = createJsonActionsStore({ homeDir })
      expect(
        await store.transact(PROJECT, () => ({
          ok: false,
          error: { code: 'actions.not-found', actionId: ID },
        })),
      ).toEqual({
        ok: false,
        error: { code: 'actions.not-found', actionId: ID },
      })
      expect(await readdir(homeDir)).toEqual([])
    })
  })

  it('rejects a blank Project id', async () => {
    await withTemporaryDirectory('porcelain-actions-blank-', async (homeDir) => {
      const store = createJsonActionsStore({ homeDir })
      expect(await store.read('   ')).toEqual({
        ok: false,
        error: { code: 'actions.unavailable' },
      })
    })
  })

  it.runIf(process.platform !== 'win32')(
    'normalizes permission failures to actions.unavailable',
    async () => {
      await withTemporaryDirectory('porcelain-actions-perm-', async (homeDir) => {
        await seed(homeDir, serializeActionsFileV1({ version: 1, actions: [] }))
        await chmod(projectDir(homeDir), 0o500)

        const store = createJsonActionsStore({ homeDir })
        const result = await store.transact(PROJECT, (current) => ({
          ok: true,
          value: {
            kind: 'delete',
            file: current,
            actionId: ID,
          },
        }))
        expect(result).toEqual({ ok: false, error: { code: 'actions.unavailable' } })
        await chmod(projectDir(homeDir), 0o700)
      })
    },
  )
})
