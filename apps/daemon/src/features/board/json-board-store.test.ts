// @vitest-environment node
import { chmod, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  emptyBoardFileV1,
  parseBoardFileV1,
  serializeBoardFileV1,
} from '@porcelain/shared/board-file'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import { BOARD_FILE_MAX_BYTES, createJsonBoardStore } from './json-board-store'

vi.mock('../../project/git-exclude', () => ({
  ensureCompanionHidden: vi.fn(async () => undefined),
}))
vi.mock('../../review/review-watch', () => ({
  watchProjectCompanion: vi.fn(),
}))

const ID = '00000000-0000-4000-8000-0000000000aa'

describe('createJsonBoardStore', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty v1 for an absent file and does not create it on read', async () => {
    await withTemporaryDirectory('porcelain-board-absent-', async (directory) => {
      const store = createJsonBoardStore()
      const result = await store.read(directory)
      expect(result).toEqual({ ok: true, value: emptyBoardFileV1() })
      expect(await readdir(directory)).toEqual([])
    })
  })

  it('round-trips a strict v1 document atomically', async () => {
    await withTemporaryDirectory('porcelain-board-roundtrip-', async (directory) => {
      const store = createJsonBoardStore()
      const card = {
        id: ID,
        title: 'Ship',
        status: 'todo' as const,
        order: 1,
        createdAt: 1,
      }
      const written = await store.transact(directory, () => ({
        ok: true,
        value: {
          kind: 'create',
          file: { version: 1, cards: [card] },
          card,
        },
      }))
      expect(written.ok).toBe(true)

      const path = join(directory, '.porcelain', 'board.json')
      const raw = await readFile(path, 'utf8')
      expect(raw).toBe(serializeBoardFileV1({ version: 1, cards: [card] }))
      expect(parseBoardFileV1(JSON.parse(raw)).cards).toHaveLength(1)

      const read = await store.read(directory)
      expect(read.ok).toBe(true)
      if (!read.ok) return
      expect(read.value.cards).toEqual([card])

      const tmpLeft = (await readdir(join(directory, '.porcelain'))).filter((name) =>
        name.startsWith('.tmp-'),
      )
      expect(tmpLeft).toEqual([])
    })
  })

  it('rejects incompatible version without deleting the file', async () => {
    await withTemporaryDirectory('porcelain-board-incompat-', async (directory) => {
      await mkdir(join(directory, '.porcelain'), { recursive: true })
      const path = join(directory, '.porcelain', 'board.json')
      await writeFile(path, `${JSON.stringify({ version: 99, cards: [] }, null, 2)}\n`)

      const store = createJsonBoardStore()
      expect(await store.read(directory)).toEqual({
        ok: false,
        error: { code: 'board.unavailable' },
      })
      expect(await readFile(path, 'utf8')).toContain('"version": 99')
    })
  })

  it('backs up malformed content and reports unavailable', async () => {
    await withTemporaryDirectory('porcelain-board-corrupt-', async (directory) => {
      await mkdir(join(directory, '.porcelain'), { recursive: true })
      const path = join(directory, '.porcelain', 'board.json')
      await writeFile(path, '{not-json')

      const store = createJsonBoardStore()
      expect(await store.read(directory)).toEqual({
        ok: false,
        error: { code: 'board.unavailable' },
      })
      const entries = await readdir(join(directory, '.porcelain'))
      expect(entries.some((name) => name.startsWith('board.json.corrupt-'))).toBe(true)
    })
  })

  it('reports oversize without rewriting the source', async () => {
    await withTemporaryDirectory('porcelain-board-large-', async (directory) => {
      await mkdir(join(directory, '.porcelain'), { recursive: true })
      const path = join(directory, '.porcelain', 'board.json')
      const payload = 'x'.repeat(200)
      await writeFile(path, payload)
      const store = createJsonBoardStore({ maxBytes: 50 })
      expect(await store.read(directory)).toEqual({
        ok: false,
        error: { code: 'board.unavailable' },
      })
      expect(await readFile(path, 'utf8')).toBe(payload)
      expect(BOARD_FILE_MAX_BYTES).toBeGreaterThan(50)
    })
  })

  it('serializes concurrent mutations on the same project', async () => {
    await withTemporaryDirectory('porcelain-board-concurrent-', async (directory) => {
      const store = createJsonBoardStore()
      let counter = 0
      await Promise.all(
        Array.from({ length: 8 }, () =>
          store.transact(directory, (current) => {
            counter += 1
            const id = `00000000-0000-4000-8000-0000000000${String(counter).padStart(2, '0')}`
            const card = {
              id,
              title: `Card ${counter}`,
              status: 'todo' as const,
              order: counter,
              createdAt: counter,
            }
            return {
              ok: true as const,
              value: {
                kind: 'create' as const,
                file: { version: 1 as const, cards: [...current.cards, card] },
                card,
              },
            }
          }),
        ),
      )
      const read = await store.read(directory)
      expect(read.ok).toBe(true)
      if (!read.ok) return
      expect(read.value.cards).toHaveLength(8)
    })
  })

  it('does not write when the change rejects', async () => {
    await withTemporaryDirectory('porcelain-board-reject-', async (directory) => {
      const store = createJsonBoardStore()
      expect(
        await store.transact(directory, () => ({
          ok: false,
          error: { code: 'board.card-not-found', cardId: ID },
        })),
      ).toEqual({
        ok: false,
        error: { code: 'board.card-not-found', cardId: ID },
      })
      expect(await readdir(directory)).toEqual([])
    })
  })

  it('normalizes permission failures to board.unavailable', async () => {
    await withTemporaryDirectory('porcelain-board-perm-', async (directory) => {
      const porcelain = join(directory, '.porcelain')
      await mkdir(porcelain, { recursive: true })
      const path = join(porcelain, 'board.json')
      await writeFile(path, serializeBoardFileV1({ version: 1, cards: [] }))
      await chmod(porcelain, 0o500)

      const store = createJsonBoardStore()
      const result = await store.transact(directory, (current) => ({
        ok: true,
        value: {
          kind: 'clear',
          file: current,
          status: 'todo',
          cardIds: [],
        },
      }))
      expect(result).toEqual({ ok: false, error: { code: 'board.unavailable' } })
      await chmod(porcelain, 0o700)
    })
  })
})
