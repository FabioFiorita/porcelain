// @vitest-environment node

import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowseDirsOutput, ProjectInfo } from '@porcelain/contracts/projects'
import { describe, expect, it, vi } from 'vitest'
import { createCanvasAccessTokens } from './canvas-access-tokens'
import { createCanvasOverlayStore } from './canvas-overlay-store'
import { createCanvasStore } from './canvas-store'
import type { EnvironmentIdentityStore } from './environment-identity-store'
import type { HubGitPort } from './hub-git-port'
import type { HubInventoryStore } from './hub-inventory-store'
import { createProjectsOperations } from './projects-operations'
import type { ProjectsEffects, ProjectsPort, ProjectsWorktree } from './projects-ports'
import type { ProjectsRecentsStore } from './projects-recents-store'

const PROJECT: ProjectInfo = { path: '/projects/alpha', name: 'alpha' }
const BROWSE: BrowseDirsOutput = { path: '/projects', parent: '/', entries: [] }

function harness(pathAllowed?: (path: string) => boolean) {
  const events: string[] = []
  const projects = {
    inspectProject: vi.fn<ProjectsPort['inspectProject']>(async (path: string) => ({
      ok: true as const,
      value: { path, name: path.split('/').at(-1) ?? '' },
    })),
    browseDirectories: vi.fn<ProjectsPort['browseDirectories']>(async () => ({
      ok: true as const,
      value: BROWSE,
    })),
  } satisfies ProjectsPort
  const recents = {
    readPaths: vi.fn<ProjectsRecentsStore['readPaths']>(async () => ({
      ok: true as const,
      value: ['/projects/alpha'],
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
  const worktree = {
    isLinkedWorktree: vi.fn<ProjectsWorktree['isLinkedWorktree']>(async () => false),
  } satisfies ProjectsWorktree
  const effects = {
    warmFileList: vi.fn<ProjectsEffects['warmFileList']>(() => events.push('warm')),
  } satisfies ProjectsEffects
  const environment = {
    read: vi.fn<EnvironmentIdentityStore['read']>(async () => ({
      ok: true as const,
      value: { id: 'env-1', name: 'synthetic' },
    })),
  } satisfies EnvironmentIdentityStore
  const inventory = {
    readProjects: vi.fn<HubInventoryStore['readProjects']>(async () => ({
      ok: true as const,
      value: [],
    })),
    writeProjects: vi.fn<HubInventoryStore['writeProjects']>(async () => ({
      ok: true as const,
      value: undefined,
    })),
  } satisfies HubInventoryStore
  const git = {
    discoverProject: vi.fn<HubGitPort['discoverProject']>(async () => ({
      ok: false as const,
      error: 'not-a-repository',
    })),
    listWorktrees: vi.fn<HubGitPort['listWorktrees']>(async () => ({
      ok: true as const,
      value: [],
    })),
    pathExists: vi.fn<HubGitPort['pathExists']>(async () => true),
    addWorktree: vi.fn<HubGitPort['addWorktree']>(async () => ({
      ok: true as const,
      value: { path: '/projects/alpha-worktrees/topic', branch: 'topic' },
    })),
    removeWorktree: vi.fn<HubGitPort['removeWorktree']>(async () => ({
      ok: true as const,
      value: undefined,
    })),
  } satisfies HubGitPort
  // Real Canvas storage aimed at a directory that does not exist: these cases
  // are about Project orchestration, and an absent store reads as "no Canvases"
  // rather than needing a mock that could drift from the real one.
  const canvas = {
    store: createCanvasStore({ homeDir: join(tmpdir(), 'porcelain-ops-no-canvas-home') }),
    overlay: createCanvasOverlayStore(),
    accessTokens: createCanvasAccessTokens(),
  }
  return {
    events,
    projects,
    recents,
    worktree,
    effects,
    environment,
    inventory,
    git,
    canvas,
    operations: createProjectsOperations({
      projects,
      recents,
      worktree,
      effects,
      hub: {
        environment,
        inventory,
        git,
        daemon: { host: 'synthetic', platform: 'linux', arch: 'x64' },
        pathAllowed,
        createId: () => 'generated',
      },
      canvas,
    }),
  }
}

describe('Project operations', () => {
  it('blocks real repositories at the development-daemon boundary', async () => {
    const h = harness((path) => path.startsWith('/playground'))

    expect(await h.operations.openProject('/home/fabiofiorita/code/porcelain')).toEqual({
      ok: false,
      error: { code: 'projects.dev-repo-forbidden' },
    })
    expect(h.projects.inspectProject).not.toHaveBeenCalled()
    expect(h.recents.addPath).not.toHaveBeenCalled()
  })

  it('keeps recognized playgrounds available under the same boundary', async () => {
    const h = harness((path) => path.startsWith('/playground'))

    expect(await h.operations.openProject('/playground/fix-review')).toEqual({
      ok: true,
      value: { path: '/playground/fix-review', name: 'fix-review' },
    })
    expect(h.recents.addPath).toHaveBeenCalledWith('/playground/fix-review')
  })

  it('validates, persists, watches, and warms in the exact open order', async () => {
    const h = harness()
    h.projects.inspectProject.mockImplementationOnce(async (path) => {
      h.events.push('validate')
      return { ok: true, value: { path, name: 'alpha' } }
    })
    h.recents.addPath.mockImplementationOnce(async () => {
      h.events.push('persist')
      return { ok: true, value: undefined }
    })

    expect(await h.operations.openProject(PROJECT.path)).toEqual({ ok: true, value: PROJECT })
    expect(h.events).toEqual(['validate', 'persist', 'warm'])
  })

  it('returns validation failures without writing or running effects', async () => {
    const h = harness()
    h.projects.inspectProject.mockResolvedValueOnce({ ok: false, error: 'not-a-directory' })

    expect(await h.operations.openProject('/projects/file.txt')).toEqual({
      ok: false,
      error: { code: 'projects.not-a-directory' },
    })
    expect(h.recents.addPath).not.toHaveBeenCalled()
    expect(h.events).toEqual([])
  })

  it('returns recents failure without running non-required effects', async () => {
    const h = harness()
    h.recents.addPath.mockResolvedValueOnce({
      ok: false,
      error: { code: 'projects.unavailable' },
    })

    expect(await h.operations.openProject(PROJECT.path)).toEqual({
      ok: false,
      error: { code: 'projects.unavailable' },
    })
    expect(h.events).toEqual([])
  })

  it('preserves recents order while dropping stale paths and hidden worktrees', async () => {
    const h = harness()
    h.recents.readPaths.mockResolvedValue({
      ok: true,
      value: ['/projects/alpha', '/projects/missing', '/projects/worktree'],
    })
    h.projects.inspectProject.mockImplementation(async (path) =>
      path === '/projects/missing'
        ? { ok: false, error: 'not-found' }
        : { ok: true, value: { path, name: path.split('/').at(-1) ?? '' } },
    )
    h.worktree.isLinkedWorktree.mockImplementation(async (path) => path.endsWith('worktree'))

    expect(await h.operations.listRecentProjects({ includeWorktrees: false })).toEqual({
      ok: true,
      value: [{ path: '/projects/alpha', name: 'alpha' }],
    })
    expect(await h.operations.listRecentProjects({ includeWorktrees: true })).toEqual({
      ok: true,
      value: [
        { path: '/projects/alpha', name: 'alpha' },
        { path: '/projects/worktree', name: 'worktree' },
      ],
    })
  })

  it('maps unavailable recents and delegates remove and browse', async () => {
    const h = harness()
    h.recents.readPaths.mockResolvedValueOnce({
      ok: false,
      error: { code: 'projects.unavailable' },
    })
    expect(await h.operations.listRecentProjects({ includeWorktrees: false })).toEqual({
      ok: false,
      error: { code: 'projects.unavailable' },
    })

    expect(await h.operations.removeRecentProject('/projects/old')).toEqual({
      ok: true,
      value: undefined,
    })
    expect(h.recents.removePath).toHaveBeenCalledWith('/projects/old')

    expect(await h.operations.browseProjectDirectories(null)).toEqual({
      ok: true,
      value: BROWSE,
    })
    expect(h.projects.browseDirectories).toHaveBeenCalledWith(null)
  })

  it('lists live Worktrees under a stable Environment and Project identity', async () => {
    const h = harness()
    h.git.discoverProject.mockResolvedValue({
      ok: true,
      value: {
        commonGitDir: '/projects/alpha/.git',
        groupingKey: 'ssh://git@example/acme/alpha',
        name: 'alpha',
        worktrees: [
          {
            path: '/projects/alpha',
            gitDir: '/projects/alpha/.git',
            branch: 'main',
            isPrimary: true,
          },
          {
            path: '/projects/alpha-worktrees/topic',
            gitDir: '/projects/alpha/.git/worktrees/topic',
            branch: 'topic',
            isPrimary: false,
          },
        ],
      },
    })
    h.git.listWorktrees.mockImplementation(async () => ({
      ok: true,
      value: [
        {
          path: '/projects/alpha',
          gitDir: '/projects/alpha/.git',
          branch: 'main',
          isPrimary: true,
        },
        {
          path: '/projects/alpha-worktrees/topic',
          gitDir: '/projects/alpha/.git/worktrees/topic',
          branch: 'topic',
          isPrimary: false,
        },
      ],
    }))

    const listed = await h.operations.listHubInventory()
    expect(listed.ok).toBe(true)
    if (!listed.ok) return
    expect(listed.value.environment).toEqual({
      id: 'env-1',
      name: 'synthetic',
      host: 'synthetic',
      platform: 'linux',
      arch: 'x64',
    })
    expect(listed.value.projects).toHaveLength(1)
    const project = listed.value.projects[0]
    expect(project?.id).toBe('generated')
    expect(project?.groupingKey).toBe('ssh://git@example/acme/alpha')
    expect(project?.worktrees.map((worktree) => worktree.branch)).toEqual(['main', 'topic'])
    expect(h.inventory.writeProjects).toHaveBeenCalled()
  })

  it('creates a Worktree through the Hub and returns the stored identity', async () => {
    const h = harness()
    const live = [
      {
        path: '/projects/alpha',
        gitDir: '/projects/alpha/.git',
        branch: 'main',
        isPrimary: true,
      },
    ]
    h.git.discoverProject.mockResolvedValue({
      ok: true,
      value: {
        commonGitDir: '/projects/alpha/.git',
        groupingKey: 'name:alpha',
        name: 'alpha',
        worktrees: live,
      },
    })
    h.git.listWorktrees.mockResolvedValueOnce({ ok: true, value: live }).mockResolvedValueOnce({
      ok: true,
      value: [
        ...live,
        {
          path: '/projects/alpha-worktrees/topic',
          gitDir: '/projects/alpha/.git/worktrees/topic',
          branch: 'topic',
          isPrimary: false,
        },
      ],
    })

    const created = await h.operations.createHubWorktree({
      projectId: 'generated',
      branch: 'topic',
      baseRef: 'origin/main',
    })
    expect(created).toEqual({
      ok: true,
      value: {
        id: 'generated',
        projectId: 'generated',
        path: '/projects/alpha-worktrees/topic',
        name: 'topic',
        branch: 'topic',
        isPrimary: false,
      },
    })
    expect(h.git.addWorktree).toHaveBeenCalledWith('/projects/alpha', 'topic', 'origin/main')
  })

  it('rejects Worktree creation for an unknown Project', async () => {
    const h = harness()
    expect(await h.operations.createHubWorktree({ projectId: 'missing', branch: 'topic' })).toEqual(
      {
        ok: false,
        error: { code: 'projects.not-found' },
      },
    )
    expect(h.git.addWorktree).not.toHaveBeenCalled()
  })

  it('removes a linked Worktree but protects the primary checkout', async () => {
    const h = harness()
    const live = [
      {
        path: '/projects/alpha',
        gitDir: '/projects/alpha/.git',
        branch: 'main',
        isPrimary: true,
      },
      {
        path: '/projects/alpha-worktrees/topic',
        gitDir: '/projects/alpha/.git/worktrees/topic',
        branch: 'topic',
        isPrimary: false,
      },
    ]
    let remaining = live
    h.inventory.readProjects.mockResolvedValue({
      ok: true,
      value: [
        {
          id: 'generated',
          commonGitDir: '/projects/alpha/.git',
          groupingKey: 'name:alpha',
          name: 'alpha',
          worktrees: [
            { id: 'main-id', gitDir: '/projects/alpha/.git' },
            { id: 'topic-id', gitDir: '/projects/alpha/.git/worktrees/topic' },
          ],
        },
      ],
    })
    h.recents.readPaths.mockResolvedValue({
      ok: true,
      value: ['/projects/alpha', '/projects/alpha-worktrees/topic'],
    })
    h.git.discoverProject.mockResolvedValue({
      ok: true,
      value: {
        commonGitDir: '/projects/alpha/.git',
        groupingKey: 'name:alpha',
        name: 'alpha',
        worktrees: remaining,
      },
    })
    h.git.listWorktrees.mockImplementation(async () => ({ ok: true, value: remaining }))
    h.git.removeWorktree.mockImplementation(async (_repoPath, worktreePath) => {
      remaining = remaining.filter((worktree) => worktree.path !== worktreePath)
      return { ok: true, value: undefined }
    })

    expect(
      await h.operations.removeHubWorktree({ projectId: 'generated', worktreeId: 'topic-id' }),
    ).toEqual({ ok: true, value: undefined })
    expect(h.git.removeWorktree).toHaveBeenCalledWith(
      '/projects/alpha',
      '/projects/alpha-worktrees/topic',
    )
    expect(h.recents.removePath).toHaveBeenCalledWith('/projects/alpha-worktrees/topic')

    remaining = live
    expect(
      await h.operations.removeHubWorktree({ projectId: 'generated', worktreeId: 'main-id' }),
    ).toEqual({ ok: false, error: { code: 'git.worktree-conflict' } })
    expect(h.git.removeWorktree).toHaveBeenCalledTimes(1)
  })

  it('removes a Project from the Hub without deleting its repository', async () => {
    const h = harness()
    h.inventory.readProjects.mockResolvedValue({
      ok: true,
      value: [
        {
          id: 'generated',
          commonGitDir: '/projects/alpha/.git',
          groupingKey: 'name:alpha',
          name: 'alpha',
          worktrees: [{ id: 'main-id', gitDir: '/projects/alpha/.git' }],
        },
      ],
    })
    h.recents.readPaths.mockResolvedValue({
      ok: true,
      value: ['/projects/alpha'],
    })
    h.git.discoverProject.mockResolvedValue({
      ok: true,
      value: {
        commonGitDir: '/projects/alpha/.git',
        groupingKey: 'name:alpha',
        name: 'alpha',
        worktrees: [
          {
            path: '/projects/alpha',
            gitDir: '/projects/alpha/.git',
            branch: 'main',
            isPrimary: true,
          },
        ],
      },
    })
    h.git.listWorktrees.mockResolvedValue({
      ok: true,
      value: [
        {
          path: '/projects/alpha',
          gitDir: '/projects/alpha/.git',
          branch: 'main',
          isPrimary: true,
        },
      ],
    })

    expect(await h.operations.removeHubProject('generated')).toEqual({
      ok: true,
      value: undefined,
    })
    expect(h.git.removeWorktree).not.toHaveBeenCalled()
    expect(h.recents.removePath).toHaveBeenCalledWith('/projects/alpha')
    expect(h.inventory.writeProjects).toHaveBeenLastCalledWith([])
  })
})
