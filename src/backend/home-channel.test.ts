import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createHomeChannel } from './home-channel'

const schema = z.record(z.string(), z.number())
type Doc = z.infer<typeof schema>
const empty = (): Doc => ({})

let dir: string
const filePath = (): string => join(dir, 'doc.json')

function make(
  overrides: Partial<Parameters<typeof createHomeChannel<Doc>>[0]> = {},
): ReturnType<typeof createHomeChannel<Doc>> {
  return createHomeChannel<Doc>({ path: filePath, schema, empty, ...overrides })
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'porcelain-home-channel-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('createHomeChannel', () => {
  it('returns empty when the file is absent', async () => {
    expect(await make().readAll()).toEqual({})
  })

  it('round-trips a write and read', async () => {
    const ch = make()
    await ch.writeAll({ a: 1, b: 2 })
    expect(await make().readAll()).toEqual({ a: 1, b: 2 })
  })

  it('backs up a corrupt file and recovers with empty', async () => {
    await writeFile(filePath(), '{ not json', 'utf8')
    expect(await make().readAll()).toEqual({})
    const files = await readdir(dir)
    expect(files.some((f) => f.startsWith('doc.json.corrupt-'))).toBe(true)
  })

  it('backs up a schema-invalid file and recovers with empty', async () => {
    await writeFile(filePath(), JSON.stringify({ a: 'not a number' }), 'utf8')
    expect(await make().readAll()).toEqual({})
    const files = await readdir(dir)
    expect(files.some((f) => f.startsWith('doc.json.corrupt-'))).toBe(true)
  })

  it('does not back up a merely-absent file', async () => {
    expect(await make().readAll()).toEqual({})
    expect(await readdir(dir)).toEqual([])
  })

  it('serializes concurrent mutations so none is dropped', async () => {
    const ch = make()
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        ch.mutate((all) => {
          all[`k${i}`] = i
        }),
      ),
    )
    expect(Object.keys(await make().readAll())).toHaveLength(10)
  })

  it('applies a transform on read', async () => {
    await writeFile(filePath(), JSON.stringify({ keep: 1, drop: -1 }), 'utf8')
    const ch = make({
      transform: (parsed) => Object.fromEntries(Object.entries(parsed).filter(([, v]) => v >= 0)),
    })
    expect(await ch.readAll()).toEqual({ keep: 1 })
  })

  it('treats an oversized file as empty without throwing', async () => {
    await writeFile(filePath(), JSON.stringify({ a: 1, b: 2, c: 3 }), 'utf8')
    const ch = make({ maxBytes: 5 })
    await expect(ch.readAll()).resolves.toEqual({})
  })

  describe("cache: 'mtime'", () => {
    it('does not re-parse when the file is unchanged, but picks up an external overwrite', async () => {
      const transform = vi.fn((parsed: Doc) => parsed)
      await writeFile(filePath(), JSON.stringify({ a: 1 }), 'utf8')
      const ch = make({ cache: 'mtime', transform })

      expect(await ch.readAll()).toEqual({ a: 1 })
      expect(await ch.readAll()).toEqual({ a: 1 })
      expect(transform).toHaveBeenCalledTimes(1) // second read served from cache

      // External writer overwrites the file — a fresh mtime/size must be picked up.
      await writeFile(filePath(), JSON.stringify({ a: 1, b: 2 }), 'utf8')
      expect(await ch.readAll()).toEqual({ a: 1, b: 2 })
      expect(transform).toHaveBeenCalledTimes(2)
    })
  })

  describe("cache: 'memory'", () => {
    it('serves the first read until a write, ignoring external changes', async () => {
      await writeFile(filePath(), JSON.stringify({ a: 1 }), 'utf8')
      const ch = make({ cache: 'memory' })

      expect(await ch.readAll()).toEqual({ a: 1 })
      // An external change is NOT reflected (memory cache assumes app-sole-writer).
      await writeFile(filePath(), JSON.stringify({ a: 99 }), 'utf8')
      expect(await ch.readAll()).toEqual({ a: 1 })

      // Our own write updates the cache and the file.
      await ch.writeAll({ a: 2 })
      expect(await ch.readAll()).toEqual({ a: 2 })
      expect(JSON.parse(await readFile(filePath(), 'utf8'))).toEqual({ a: 2 })
    })
  })
})
