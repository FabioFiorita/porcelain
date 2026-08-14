// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHubInventoryStore, type HubInventoryStore } from './hub-inventory-store'

let directory = ''
let store: HubInventoryStore

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'porcelain-hub-inventory-'))
  store = createHubInventoryStore({ path: join(directory, 'hub-inventory.json') })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(directory, { recursive: true, force: true })
})

describe('Hub inventory store', () => {
  it('reads an absent file as empty without creating it', async () => {
    expect(await store.readProjects()).toEqual({ ok: true, value: [] })
    expect(
      await readFile(join(directory, 'hub-inventory.json'), 'utf8').catch(() => 'missing'),
    ).toBe('missing')
  })

  it('persists Project and Worktree identities without storing checkout paths', async () => {
    const projects = [
      {
        id: 'proj-alpha',
        commonGitDir: '/repos/alpha/.git',
        groupingKey: 'name:alpha',
        name: 'alpha',
        worktrees: [{ id: 'wt-main', gitDir: '/repos/alpha/.git' }],
      },
    ]
    expect(await store.writeProjects(projects)).toEqual({ ok: true, value: undefined })
    expect(JSON.parse(await readFile(join(directory, 'hub-inventory.json'), 'utf8'))).toEqual({
      version: 1,
      value: { projects },
    })
    expect(await store.readProjects()).toEqual({ ok: true, value: projects })
  })
})
