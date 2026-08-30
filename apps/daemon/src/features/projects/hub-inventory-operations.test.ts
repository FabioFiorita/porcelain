// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import type { EnvironmentIdentityStore } from './environment-identity-store'
import type { HubGitPort } from './hub-git-port'
import {
  createHubInventoryOperations,
  type HubInventoryOperations,
} from './hub-inventory-operations'
import type { StoredHubProject, DiscoveredProject } from './hub-identity'
import type { HubInventoryStore } from './hub-inventory-store'
import type { ProjectsRecentsStore } from './projects-recents-store'

function discovered(name: string): DiscoveredProject {
  const path = `/projects/${name}`
  const commonGitDir = `${path}/.git`
  return {
    commonGitDir,
    groupingKey: `name:${name}`,
    name,
    worktrees: [{ path, gitDir: commonGitDir, branch: 'main', isPrimary: true }],
  }
}

function stored(name: string): StoredHubProject {
  const project = discovered(name)
  return {
    id: `${name}-id`,
    commonGitDir: project.commonGitDir,
    groupingKey: project.groupingKey,
    name: project.name,
    worktrees: [{ id: `${name}-main-id`, gitDir: project.commonGitDir }],
  }
}

function deferred() {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

function harness(input: { recents?: string[]; projects?: StoredHubProject[] } = {}) {
  let projects = input.projects ?? []
  const recents = {
    readPaths: vi.fn<ProjectsRecentsStore['readPaths']>(async () => ({
      ok: true as const,
      value: input.recents ?? [],
    })),
    addPath: vi.fn<ProjectsRecentsStore['addPath']>(async () => ({
      ok: true as const,
      value: undefined,
    })),
    removePath: vi.fn<ProjectsRecentsStore['removePath']>(async () => ({
      ok: true as const,
      value: undefined,
    })),
  } satisfies ProjectsRecentsStore
  const inventory = {
    readProjects: vi.fn<HubInventoryStore['readProjects']>(async () => ({
      ok: true as const,
      value: projects,
    })),
    writeProjects: vi.fn<HubInventoryStore['writeProjects']>(async (next) => {
      projects = [...next]
      return { ok: true as const, value: undefined }
    }),
  } satisfies HubInventoryStore
  const environment = {
    read: vi.fn<EnvironmentIdentityStore['read']>(async () => ({
      ok: true as const,
      value: { id: 'environment-id', name: 'synthetic' },
    })),
    rename: vi.fn<EnvironmentIdentityStore['rename']>(async () => ({
      ok: true as const,
      value: { id: 'environment-id', name: 'synthetic' },
    })),
    defaultName: vi.fn<EnvironmentIdentityStore['defaultName']>(() => 'synthetic'),
  } satisfies EnvironmentIdentityStore
  const git = {
    discoverProject: vi.fn<HubGitPort['discoverProject']>(async () => ({
      ok: false as const,
      error: 'not-a-repository' as const,
    })),
    listWorktrees: vi.fn<HubGitPort['listWorktrees']>(async () => ({
      ok: true as const,
      value: [],
    })),
    pathExists: vi.fn<HubGitPort['pathExists']>(async () => true),
    addWorktree: vi.fn<HubGitPort['addWorktree']>(async () => ({
      ok: true as const,
      value: { path: '/projects/topic', branch: 'topic' },
    })),
    removeWorktree: vi.fn<HubGitPort['removeWorktree']>(async () => ({
      ok: true as const,
      value: undefined,
    })),
  } satisfies HubGitPort

  const operations: HubInventoryOperations = createHubInventoryOperations({
    environment,
    inventory,
    recents,
    git,
    daemon: { host: 'synthetic', platform: 'linux', arch: 'x64' },
    createId: () => 'new-id',
  })
  return { operations, git, inventory }
}

describe('Hub inventory operations performance', () => {
  it('discovers recents concurrently, checks stored paths once, and reuses their worktrees', async () => {
    const h = harness({
      recents: ['/projects/alpha', '/projects/beta'],
      projects: [stored('alpha'), stored('beta')],
    })
    const bothDiscoveriesStarted = deferred()
    const releaseDiscoveries = deferred()
    const byPath = new Map([
      ['/projects/alpha', discovered('alpha')],
      ['/projects/beta', discovered('beta')],
    ])
    let started = 0
    h.git.discoverProject.mockImplementation(async (path) => {
      started += 1
      if (started === 2) bothDiscoveriesStarted.resolve()
      await releaseDiscoveries.promise
      const value = byPath.get(path)
      if (value === undefined) return { ok: false, error: 'not-a-repository' }
      return { ok: true, value }
    })

    const listed = h.operations.listHubInventory()
    await bothDiscoveriesStarted.promise
    expect(h.git.discoverProject).toHaveBeenCalledTimes(2)
    releaseDiscoveries.resolve()

    expect(await listed).toMatchObject({ ok: true })
    // Previously each recent path rebuilt this same two-entry map, causing four checks.
    expect(h.git.pathExists).toHaveBeenCalledTimes(2)
    // The discovery already supplied these exact worktrees, so no immediate second Git scan runs.
    expect(h.git.listWorktrees).not.toHaveBeenCalled()
  })

  it('refreshes independent stored Projects concurrently without changing their order', async () => {
    const h = harness({ projects: [stored('alpha'), stored('beta')] })
    const bothRefreshesStarted = deferred()
    const releaseRefreshes = deferred()
    let started = 0
    h.git.listWorktrees.mockImplementation(async (commonGitDir) => {
      started += 1
      if (started === 2) bothRefreshesStarted.resolve()
      await releaseRefreshes.promise
      const name = commonGitDir.split('/').at(-2)
      return { ok: true, value: discovered(name ?? 'unknown').worktrees }
    })

    const listed = h.operations.listHubInventory()
    await bothRefreshesStarted.promise
    expect(h.git.listWorktrees).toHaveBeenCalledTimes(2)
    releaseRefreshes.resolve()

    const result = await listed
    expect(result.ok && result.value.projects.map((project) => project.id)).toEqual([
      'alpha-id',
      'beta-id',
    ])
  })

  it('hands a registered discovery to the next rebuild only once', async () => {
    const h = harness({ recents: ['/projects/alpha'] })
    h.git.discoverProject.mockResolvedValue({ ok: true, value: discovered('alpha') })

    await h.operations.registerPath('/projects/alpha')
    expect(h.inventory.writeProjects).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'new-id', commonGitDir: '/projects/alpha/.git' }),
    ])
    const first = await h.operations.listHubInventory()
    expect(first.ok && first.value.projects.map((project) => project.id)).toEqual(['new-id'])

    const second = await h.operations.listHubInventory()
    expect(second.ok && second.value.projects.map((project) => project.id)).toEqual(['new-id'])
    // registerPath discovers once, the immediate rebuild consumes it, and only the later rebuild
    // must ask Git again.
    expect(h.git.discoverProject).toHaveBeenCalledTimes(2)
    expect(h.git.listWorktrees).not.toHaveBeenCalled()
  })
})
