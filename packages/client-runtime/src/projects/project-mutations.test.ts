import { describe, expect, it } from 'vitest'
import {
  createHubWorktree,
  openProject,
  promoteCanvas,
  promoteOverrides,
  removeRecentProject,
} from './project-mutations'

describe('Project mutation effects', () => {
  it('binds open to the canonical procedure and both recent identities', () => {
    expect(openProject.procedureName).toBe('openRepoPath')
    expect(openProject.procedure).toBeDefined()
    expect(openProject.affectedQueries('/synthetic/projects/alpha')).toEqual([
      { domain: 'projects', name: 'recent', includeWorktrees: false },
      { domain: 'projects', name: 'recent', includeWorktrees: true },
      { domain: 'projects', name: 'inventory' },
    ])
    expect(openProject.optimistic).toBe(false)
    expect(openProject.requiresAuthoritativeRefetch).toBe(true)
    expect(openProject.selectionEffect).toBe('select-result')
  })

  it('binds remove to exact recent effects and conditional selection clearing', () => {
    expect(removeRecentProject.procedureName).toBe('removeRecentRepo')
    expect(removeRecentProject.procedure).toBeDefined()
    expect(removeRecentProject.affectedQueries('/synthetic/projects/old')).toEqual([
      { domain: 'projects', name: 'recent', includeWorktrees: false },
      { domain: 'projects', name: 'recent', includeWorktrees: true },
      { domain: 'projects', name: 'inventory' },
    ])
    expect(removeRecentProject.optimistic).toBe(false)
    expect(removeRecentProject.requiresAuthoritativeRefetch).toBe(true)
    expect(removeRecentProject.selectionEffect).toBe('clear-if-selected-input')
  })

  it('binds Hub Worktree creation to inventory refresh', () => {
    expect(createHubWorktree.procedureName).toBe('createHubWorktree')
    expect(createHubWorktree.affectedQueries({ projectId: 'proj-alpha', branch: 'topic' })).toEqual(
      [
        { domain: 'projects', name: 'recent', includeWorktrees: false },
        { domain: 'projects', name: 'recent', includeWorktrees: true },
        { domain: 'projects', name: 'inventory' },
      ],
    )
  })

  it('binds Canvas promotion to both checkout-scoped and private Canvas identities', () => {
    expect(promoteCanvas.procedureName).toBe('promoteCanvas')
    expect(
      promoteCanvas.affectedQueries({
        projectId: 'proj-alpha',
        canvasId: 'canvas-intent',
        path: '/synthetic/projects/alpha',
      }),
    ).toEqual([
      {
        domain: 'projects',
        name: 'canvases',
        projectId: 'proj-alpha',
        worktreePath: '/synthetic/projects/alpha',
        worktreeId: null,
      },
      {
        domain: 'projects',
        name: 'canvases',
        projectId: 'proj-alpha',
        worktreePath: null,
        worktreeId: null,
      },
      {
        domain: 'projects',
        name: 'canvas',
        projectId: 'proj-alpha',
        canvasId: 'canvas-intent',
        worktreePath: '/synthetic/projects/alpha',
      },
      { domain: 'projects', name: 'overlay', path: '/synthetic/projects/alpha' },
    ])
    expect(promoteCanvas.optimistic).toBe(false)
    expect(promoteCanvas.selectionEffect).toBe('none')
  })

  it('binds tracked project defaults to that checkout overlay alone', () => {
    expect(promoteOverrides.procedureName).toBe('promoteOverrides')
    expect(
      promoteOverrides.affectedQueries({
        projectId: 'proj-alpha',
        path: '/synthetic/projects/alpha',
        hiddenPaths: ['apps/legacy'],
      }),
    ).toEqual([{ domain: 'projects', name: 'overlay', path: '/synthetic/projects/alpha' }])
    expect(promoteOverrides.requiresAuthoritativeRefetch).toBe(true)
  })
})
