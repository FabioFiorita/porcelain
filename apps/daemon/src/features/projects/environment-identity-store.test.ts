// @vitest-environment node
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createEnvironmentIdentityStore,
  type EnvironmentIdentityStore,
} from './environment-identity-store'

let directory = ''
let path = ''
let store: EnvironmentIdentityStore

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'porcelain-environment-identity-'))
  path = join(directory, 'environment-identity.json')
  store = createEnvironmentIdentityStore({
    path,
    defaultName: 'beelink',
    createId: () => 'env-fixed',
  })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(directory, { recursive: true, force: true })
})

describe('Environment identity store', () => {
  it('mints a stable identity once and reuses it', async () => {
    expect(await store.read()).toEqual({
      ok: true,
      value: { id: 'env-fixed', name: 'beelink' },
    })
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
      version: 1,
      value: { id: 'env-fixed', name: 'beelink' },
    })
    expect(await store.read()).toEqual({
      ok: true,
      value: { id: 'env-fixed', name: 'beelink' },
    })
  })

  it('keeps a previously written name and id', async () => {
    await writeFile(
      path,
      JSON.stringify({ version: 1, value: { id: 'env-kept', name: 'Studio' } }),
      'utf8',
    )
    expect(await store.read()).toEqual({
      ok: true,
      value: { id: 'env-kept', name: 'Studio' },
    })
  })

  it('backs up malformed content and reports unavailable', async () => {
    await writeFile(path, '{not-json', 'utf8')
    expect(await store.read()).toEqual({
      ok: false,
      error: { code: 'projects.unavailable' },
    })
    expect(
      (await readdir(directory)).some((name) =>
        name.startsWith('environment-identity.json.corrupt-'),
      ),
    ).toBe(true)
  })

  it('sets a nickname, and the nickname wins over the machine name', async () => {
    expect(await store.rename('  Beelink (work)  ')).toEqual({
      ok: true,
      value: { id: 'env-fixed', name: 'Beelink (work)' },
    })
    // Persisted, so the next client to ask gets the nickname rather than the hostname.
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
      version: 1,
      value: { id: 'env-fixed', name: 'Beelink (work)' },
    })
    expect(await store.read()).toEqual({
      ok: true,
      value: { id: 'env-fixed', name: 'Beelink (work)' },
    })
  })

  it('falls back to the machine name when the nickname is cleared', async () => {
    await store.rename('Beelink (work)')
    expect(await store.rename('')).toEqual({
      ok: true,
      value: { id: 'env-fixed', name: 'beelink' },
    })
    expect(await store.read()).toEqual({ ok: true, value: { id: 'env-fixed', name: 'beelink' } })
  })

  it('treats a whitespace-only nickname as cleared, never as a blank label', async () => {
    await store.rename('Beelink (work)')
    expect(await store.rename('   \t \n ')).toEqual({
      ok: true,
      value: { id: 'env-fixed', name: 'beelink' },
    })
  })

  it('keeps the minted id across renames', async () => {
    const first = await store.read()
    await store.rename('Studio')
    const renamed = await store.read()
    expect(renamed.ok && first.ok && renamed.value.id).toBe(first.ok ? first.value.id : null)
  })

  it('renames a store whose document does not exist yet', async () => {
    expect(await store.rename('Studio')).toEqual({
      ok: true,
      value: { id: 'env-fixed', name: 'Studio' },
    })
  })

  it('reports the machine-derived default a cleared nickname falls back to', () => {
    expect(store.defaultName()).toBe('beelink')
  })

  it('serializes concurrent renames instead of losing one', async () => {
    await Promise.all([store.rename('one'), store.rename('two'), store.rename('three')])
    const read = await store.read()
    expect(read.ok && read.value.name).toBe('three')
  })

  it('reports unavailable rather than renaming over a corrupt document', async () => {
    await writeFile(path, '{not-json', 'utf8')
    expect(await store.rename('Studio')).toEqual({
      ok: false,
      error: { code: 'projects.unavailable' },
    })
  })
})
