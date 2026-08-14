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
})
