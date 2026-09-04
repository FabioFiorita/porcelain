// @vitest-environment node
import { chmod, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  COMMENTS_FILE_MAX_BYTES,
  emptyCommentsFileV1,
  parseCommentsFileV1,
  serializeCommentsFileV1,
} from '@porcelain/shared/comments-file'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import { createJsonCommentStore } from './json-comment-store'

vi.mock('../../project/git-exclude', () => ({
  ensureCompanionHidden: vi.fn(async () => undefined),
}))
vi.mock('../../review/review-watch', () => ({
  watchProjectCompanion: vi.fn(),
}))

const ID = 'comment-aa'

describe('createJsonCommentStore', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty v1 for an absent file and does not create it on read', async () => {
    await withTemporaryDirectory('porcelain-comments-absent-', async (directory) => {
      const store = createJsonCommentStore()
      const result = await store.read(directory)
      expect(result).toEqual({ ok: true, value: emptyCommentsFileV1() })
      expect(await readdir(directory)).toEqual([])
    })
  })

  it('round-trips a strict v1 document atomically', async () => {
    await withTemporaryDirectory('porcelain-comments-roundtrip-', async (directory) => {
      const store = createJsonCommentStore()
      const comment = {
        id: ID,
        path: 'src/a.ts',
        body: 'look',
        resolved: false,
        createdAt: 1,
      }
      const written = await store.transact(directory, () => ({
        ok: true,
        value: {
          kind: 'add',
          file: { version: 1, comments: [comment] },
          comment,
        },
      }))
      expect(written.ok).toBe(true)

      const path = join(directory, '.porcelain', 'active-review', 'comments.json')
      const raw = await readFile(path, 'utf8')
      expect(raw).toBe(serializeCommentsFileV1({ version: 1, comments: [comment] }))
      expect(parseCommentsFileV1(JSON.parse(raw)).comments).toHaveLength(1)

      const read = await store.read(directory)
      expect(read.ok).toBe(true)
      if (!read.ok) return
      expect(read.value.comments).toEqual([comment])

      const tmpLeft = (await readdir(join(directory, '.porcelain', 'active-review'))).filter(
        (name) => name.startsWith('.tmp-'),
      )
      expect(tmpLeft).toEqual([])
    })
  })

  it('rejects incompatible version without deleting the file', async () => {
    await withTemporaryDirectory('porcelain-comments-incompat-', async (directory) => {
      await mkdir(join(directory, '.porcelain', 'active-review'), { recursive: true })
      const path = join(directory, '.porcelain', 'active-review', 'comments.json')
      await writeFile(path, `${JSON.stringify({ version: 99, comments: [] }, null, 2)}\n`)

      const store = createJsonCommentStore()
      expect(await store.read(directory)).toEqual({
        ok: false,
        error: { code: 'review.unavailable' },
      })
      expect(await readFile(path, 'utf8')).toContain('"version": 99')
    })
  })

  it('backs up malformed content and top-level arrays, reports unavailable', async () => {
    await withTemporaryDirectory('porcelain-comments-corrupt-', async (directory) => {
      await mkdir(join(directory, '.porcelain', 'active-review'), { recursive: true })
      const path = join(directory, '.porcelain', 'active-review', 'comments.json')
      await writeFile(path, '{not-json')

      const store = createJsonCommentStore()
      expect(await store.read(directory)).toEqual({
        ok: false,
        error: { code: 'review.unavailable' },
      })
      const entries = await readdir(join(directory, '.porcelain', 'active-review'))
      expect(entries.some((name) => name.startsWith('comments.json.corrupt-'))).toBe(true)
    })

    await withTemporaryDirectory('porcelain-comments-array-', async (directory) => {
      await mkdir(join(directory, '.porcelain', 'active-review'), { recursive: true })
      const path = join(directory, '.porcelain', 'active-review', 'comments.json')
      await writeFile(path, '[]\n')

      const store = createJsonCommentStore()
      expect(await store.read(directory)).toEqual({
        ok: false,
        error: { code: 'review.unavailable' },
      })
      const entries = await readdir(join(directory, '.porcelain', 'active-review'))
      expect(entries.some((name) => name.startsWith('comments.json.corrupt-'))).toBe(true)
    })
  })

  it('reports oversize without rewriting the source', async () => {
    await withTemporaryDirectory('porcelain-comments-large-', async (directory) => {
      await mkdir(join(directory, '.porcelain', 'active-review'), { recursive: true })
      const path = join(directory, '.porcelain', 'active-review', 'comments.json')
      const payload = 'x'.repeat(200)
      await writeFile(path, payload)
      const store = createJsonCommentStore({ maxBytes: 50 })
      expect(await store.read(directory)).toEqual({
        ok: false,
        error: { code: 'review.unavailable' },
      })
      expect(await readFile(path, 'utf8')).toBe(payload)
      expect(COMMENTS_FILE_MAX_BYTES).toBeGreaterThan(50)
    })
  })

  it('rejects a mutation that would create an oversized document before writing', async () => {
    await withTemporaryDirectory('porcelain-comments-write-large-', async (directory) => {
      const store = createJsonCommentStore({ maxBytes: 100 })
      const comment = {
        id: ID,
        path: 'src/a.ts',
        body: 'x'.repeat(200),
        resolved: false,
        createdAt: 1,
      }

      expect(
        await store.transact(directory, () => ({
          ok: true,
          value: {
            kind: 'add',
            file: { version: 1, comments: [comment] },
            comment,
          },
        })),
      ).toEqual({ ok: false, error: { code: 'review.unavailable' } })
      expect(await readdir(directory)).toEqual([])
    })
  })

  it('serializes concurrent mutations on the same project', async () => {
    await withTemporaryDirectory('porcelain-comments-concurrent-', async (directory) => {
      const store = createJsonCommentStore()
      let counter = 0
      await Promise.all(
        Array.from({ length: 8 }, () =>
          store.transact(directory, (current) => {
            counter += 1
            const comment = {
              id: `comment-${String(counter).padStart(2, '0')}`,
              path: 'a.ts',
              body: `n${counter}`,
              resolved: false,
              createdAt: counter,
            }
            return {
              ok: true as const,
              value: {
                kind: 'add' as const,
                file: { version: 1 as const, comments: [...current.comments, comment] },
                comment,
              },
            }
          }),
        ),
      )
      const read = await store.read(directory)
      expect(read.ok).toBe(true)
      if (!read.ok) return
      expect(read.value.comments).toHaveLength(8)
    })
  })

  it('does not write when the change rejects', async () => {
    await withTemporaryDirectory('porcelain-comments-reject-', async (directory) => {
      const store = createJsonCommentStore()
      expect(
        await store.transact(directory, () => ({
          ok: false,
          error: { code: 'review.comment-not-found', commentId: ID },
        })),
      ).toEqual({
        ok: false,
        error: { code: 'review.comment-not-found', commentId: ID },
      })
      expect(await readdir(directory)).toEqual([])
    })
  })

  it('rejects relative project paths', async () => {
    const store = createJsonCommentStore()
    expect(await store.read('relative/repo')).toEqual({
      ok: false,
      error: { code: 'review.unavailable' },
    })
  })

  it.runIf(process.platform !== 'win32')(
    'normalizes permission failures to review.unavailable',
    async () => {
      const store = createJsonCommentStore()
      await withTemporaryDirectory('porcelain-comments-perm-', async (directory) => {
        const active = join(directory, '.porcelain', 'active-review')
        await mkdir(active, { recursive: true })
        const path = join(active, 'comments.json')
        await writeFile(path, serializeCommentsFileV1({ version: 1, comments: [] }))
        await chmod(active, 0o500)

        const result = await store.transact(directory, (current) => ({
          ok: true,
          value: {
            kind: 'clear',
            file: current,
            removedIds: [],
          },
        }))
        expect(result).toEqual({ ok: false, error: { code: 'review.unavailable' } })
        await chmod(active, 0o700)
      })
    },
  )
})
