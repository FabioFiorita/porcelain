// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const scopeStore = vi.hoisted(() => ({
  readRepoScope: vi.fn(async () => ({ hiddenPaths: ['/repo/.env'], pinnedPaths: ['/repo/src'] })),
  hidePath: vi.fn(async () => undefined),
  unhidePath: vi.fn(async () => undefined),
  pinPath: vi.fn(async () => undefined),
  unpinPath: vi.fn(async () => undefined),
}))

vi.mock('../../stores/scope-store', () => ({ createScopeStore: () => scopeStore }))

import { createFilesScope } from './files-scope'

const REPO = '/repo'

describe('createFilesScope', () => {
  it('exposes the scope store through the Files capability boundary', async () => {
    const scope = createFilesScope({
      homeDir: '/synthetic/home',
      projectIdForRepo: async () => 'project-1',
    })

    await expect(scope.read(REPO)).resolves.toEqual({
      hiddenPaths: ['/repo/.env'],
      pinnedPaths: ['/repo/src'],
    })
    await scope.hidePath(REPO, '/repo/.env')
    await scope.unhidePath(REPO, '/repo/.env')
    await scope.pinPath(REPO, '/repo/src')
    await scope.unpinPath(REPO, '/repo/src')

    expect(scopeStore.readRepoScope).toHaveBeenCalledWith(REPO)
    expect(scopeStore.hidePath).toHaveBeenCalledWith(REPO, '/repo/.env')
    expect(scopeStore.unhidePath).toHaveBeenCalledWith(REPO, '/repo/.env')
    expect(scopeStore.pinPath).toHaveBeenCalledWith(REPO, '/repo/src')
    expect(scopeStore.unpinPath).toHaveBeenCalledWith(REPO, '/repo/src')
  })
})
