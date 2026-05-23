import { mkdtemp, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createJsonStore } from './json-store'

const schema = z.object({ n: z.number() })
type Doc = z.infer<typeof schema>
const empty: Doc = { n: 0 }
const parse = (raw: unknown): Doc => schema.parse(raw)

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'porcelain-json-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function makeStore(): ReturnType<typeof createJsonStore<Doc>> {
  return createJsonStore({ path: () => join(dir, 'doc.json'), parse, empty })
}

describe('createJsonStore', () => {
  it('returns empty when the file is missing', async () => {
    expect(await makeStore().load()).toEqual({ n: 0 })
  })

  it('roundtrips an update through a fresh store', async () => {
    await makeStore().update(() => ({ n: 7 }))
    expect(await makeStore().load()).toEqual({ n: 7 })
  })

  it('backs up a corrupt file and recovers with empty', async () => {
    await writeFile(join(dir, 'doc.json'), '{ broken', 'utf8')
    expect(await makeStore().load()).toEqual({ n: 0 })
    const files = await readdir(dir)
    expect(files.some((f) => f.startsWith('doc.json.corrupt-'))).toBe(true)
  })

  it('does not lose concurrent updates', async () => {
    const store = makeStore()
    await Promise.all(
      Array.from({ length: 10 }, () => store.update((current) => ({ n: current.n + 1 }))),
    )
    expect(await store.load()).toEqual({ n: 10 })
    expect(await makeStore().load()).toEqual({ n: 10 })
  })
})
