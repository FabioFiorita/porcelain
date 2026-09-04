import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { hubInventorySchema, projectsContractFixtures } from '@porcelain/contracts/projects'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { userData } = vi.hoisted(() => ({ userData: `/tmp/porcelain-hub-cache-${process.pid}` }))
vi.mock('electron', () => ({ app: { getPath: (): string => userData } }))

import { loadShellHubInventoryCache, saveShellHubInventoryCache } from './shell-hub-inventory-cache'

const path = join(userData, 'hub-inventory-cache.json')
const remoteInventory = hubInventorySchema.parse(projectsContractFixtures.hubInventory.output)

beforeEach(async () => {
  await rm(userData, { recursive: true, force: true })
  await mkdir(userData, { recursive: true })
})

describe('shell Hub inventory cache', () => {
  it('atomically persists only a versioned remote Project snapshot', async () => {
    await saveShellHubInventoryCache({ remote: remoteInventory })

    expect(await loadShellHubInventoryCache()).toEqual({
      remote: projectsContractFixtures.hubInventory.output,
    })
    const raw = await readFile(path, 'utf8')
    expect(JSON.parse(raw)).toEqual({
      version: 1,
      inventories: { remote: projectsContractFixtures.hubInventory.output },
    })
    expect(raw).not.toContain('pc_client_')
  })

  it('treats a malformed disposable cache as empty', async () => {
    await saveShellHubInventoryCache({ remote: remoteInventory })
    await import('node:fs/promises').then(({ writeFile }) => writeFile(path, '{bad json'))

    await expect(loadShellHubInventoryCache()).resolves.toEqual({})
  })
})
