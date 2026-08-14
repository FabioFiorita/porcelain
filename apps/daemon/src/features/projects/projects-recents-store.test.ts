// @vitest-environment node
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createProjectsRecentsStore,
  MAX_RECENT_PROJECTS,
  type ProjectsRecentsStore,
} from './projects-recents-store'

let directory = ''
let path = ''
let store: ProjectsRecentsStore

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'porcelain-projects-recents-'))
  path = join(directory, 'projects-recents.json')
  store = createProjectsRecentsStore({ path })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(directory, { recursive: true, force: true })
})

describe('Projects recents store', () => {
  it('reads an absent file as empty without creating it', async () => {
    expect(await store.readPaths()).toEqual({ ok: true, value: [] })
    expect(await readdir(directory)).toEqual([])
  })

  it('writes and reads the strict DAT-001 v1 envelope atomically', async () => {
    expect(await store.addPath('/projects/alpha')).toEqual({ ok: true, value: undefined })
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
      version: 1,
      value: { paths: ['/projects/alpha'] },
    })
    expect(await store.readPaths()).toEqual({ ok: true, value: ['/projects/alpha'] })
    expect((await readdir(directory)).filter((name) => name.startsWith('.tmp-'))).toEqual([])
  })

  it('prepends, deduplicates, caps, and removes paths idempotently', async () => {
    for (let index = 0; index < MAX_RECENT_PROJECTS + 2; index += 1) {
      expect(await store.addPath(`/projects/${index}`)).toEqual({ ok: true, value: undefined })
    }
    expect(await store.addPath('/projects/3')).toEqual({ ok: true, value: undefined })

    const paths = await store.readPaths()
    expect(paths.ok).toBe(true)
    if (!paths.ok) return
    expect(paths.value).toHaveLength(MAX_RECENT_PROJECTS)
    expect(paths.value[0]).toBe('/projects/3')
    expect(new Set(paths.value).size).toBe(MAX_RECENT_PROJECTS)

    expect(await store.removePath('/projects/3')).toEqual({ ok: true, value: undefined })
    expect(await store.removePath('/projects/missing')).toEqual({ ok: true, value: undefined })
    const afterRemoval = await store.readPaths()
    if (!afterRemoval.ok) throw new Error('expected readPaths to succeed')
    expect(afterRemoval.value).not.toContain('/projects/3')
  })

  it('backs up malformed content and reports unavailable', async () => {
    await writeFile(path, '{not-json', 'utf8')

    expect(await store.readPaths()).toEqual({
      ok: false,
      error: { code: 'projects.unavailable' },
    })
    expect(
      (await readdir(directory)).some((name) => name.startsWith('projects-recents.json.corrupt-')),
    ).toBe(true)
  })

  it('preserves incompatible future versions and reports unavailable', async () => {
    const future = JSON.stringify({ version: 99, value: { paths: ['/future'] } })
    await writeFile(path, future, 'utf8')

    expect(await store.readPaths()).toEqual({
      ok: false,
      error: { code: 'projects.unavailable' },
    })
    expect(await readFile(path, 'utf8')).toBe(future)
  })

  it('reports oversized content without rewriting the source', async () => {
    const payload = 'x'.repeat(200)
    await writeFile(path, payload, 'utf8')
    const small = createProjectsRecentsStore({ path, maxBytes: 50 })

    expect(await small.readPaths()).toEqual({
      ok: false,
      error: { code: 'projects.unavailable' },
    })
    expect(await readFile(path, 'utf8')).toBe(payload)
  })

  it('serializes concurrent read-modify-write mutations', async () => {
    await Promise.all(
      Array.from({ length: MAX_RECENT_PROJECTS }, (_, index) =>
        store.addPath(`/projects/${index}`),
      ),
    )
    const paths = await store.readPaths()
    expect(paths.ok).toBe(true)
    if (!paths.ok) return
    expect(paths.value).toHaveLength(MAX_RECENT_PROJECTS)
    expect(new Set(paths.value)).toEqual(
      new Set(Array.from({ length: MAX_RECENT_PROJECTS }, (_, index) => `/projects/${index}`)),
    )
  })
})
