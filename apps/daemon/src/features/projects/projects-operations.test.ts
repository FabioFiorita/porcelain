// @vitest-environment node
import type { BrowseDirsOutput, ProjectInfo } from '@porcelain/contracts/projects'
import { describe, expect, it, vi } from 'vitest'
import { createProjectsOperations } from './projects-operations'
import type { ProjectsEffects, ProjectsPort, ProjectsWorktree } from './projects-ports'
import type { ProjectsRecentsStore } from './projects-recents-store'

const PROJECT: ProjectInfo = { path: '/projects/alpha', name: 'alpha' }
const BROWSE: BrowseDirsOutput = { path: '/projects', parent: '/', entries: [] }

function harness() {
  const events: string[] = []
  const projects: ProjectsPort = {
    inspectProject: vi.fn(async (path: string) => ({
      ok: true as const,
      value: { path, name: path.split('/').at(-1) ?? '' },
    })),
    browseDirectories: vi.fn(async () => ({ ok: true as const, value: BROWSE })),
  }
  const recents: ProjectsRecentsStore = {
    readPaths: vi.fn(async () => ({ ok: true as const, value: ['/projects/alpha'] })),
    addPath: vi.fn(async () => ({ ok: true as const, value: undefined })),
    removePath: vi.fn(async () => ({ ok: true as const, value: undefined })),
  }
  const worktree: ProjectsWorktree = {
    isLinkedWorktree: vi.fn(async () => false),
  }
  const effects: ProjectsEffects = {
    watchProjectCompanion: vi.fn(() => events.push('watch')),
    warmFileList: vi.fn(() => events.push('warm')),
  }
  return {
    events,
    projects,
    recents,
    worktree,
    effects,
    operations: createProjectsOperations({ projects, recents, worktree, effects }),
  }
}

describe('Project operations', () => {
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
    expect(h.events).toEqual(['validate', 'persist', 'watch', 'warm'])
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
})
