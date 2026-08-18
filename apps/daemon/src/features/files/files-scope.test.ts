// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const scopeStore = vi.hoisted(() => ({
  readRepoScope: vi.fn(async () => ({ hiddenPaths: ['/repo/.env'], pinnedPaths: ['/repo/src'] })),
  hidePath: vi.fn(async () => undefined),
  unhidePath: vi.fn(async () => undefined),
  pinPath: vi.fn(async () => undefined),
  unpinPath: vi.fn(async () => undefined),
  profileViewForRepo: vi.fn(async () => ({
    worktreeId: 'wt-1',
    base: { hiddenPaths: ['.env'], pinnedPaths: ['src'], layers: [] },
    override: null,
    resolved: { hiddenPaths: ['.env'], pinnedPaths: ['src'], layers: [] },
  })),
}))

vi.mock('../../stores/scope-store', () => ({ createScopeStore: () => scopeStore }))

import { createFilesScope } from './files-scope'

const REPO = '/repo'

describe('createFilesScope', () => {
  it('exposes the scope store through the Files capability boundary', async () => {
    const scope = createFilesScope({
      homeDir: '/synthetic/home',
      identityForRepo: async () => ({ projectId: 'project-1', worktreeId: 'wt-1' }),
    })

    await expect(scope.read(REPO)).resolves.toEqual({
      hiddenPaths: ['/repo/.env'],
      pinnedPaths: ['/repo/src'],
    })
    await scope.hidePath(REPO, '/repo/.env')
    await scope.unhidePath(REPO, '/repo/.env')
    await scope.pinPath(REPO, '/repo/src')
    await scope.unpinPath(REPO, '/repo/src')

    await expect(scope.readProfile(REPO)).resolves.toMatchObject({ worktreeId: 'wt-1' })

    expect(scopeStore.readRepoScope).toHaveBeenCalledWith(REPO)
    expect(scopeStore.hidePath).toHaveBeenCalledWith(REPO, '/repo/.env')
    expect(scopeStore.unhidePath).toHaveBeenCalledWith(REPO, '/repo/.env')
    expect(scopeStore.pinPath).toHaveBeenCalledWith(REPO, '/repo/src')
    expect(scopeStore.unpinPath).toHaveBeenCalledWith(REPO, '/repo/src')
  })
})
