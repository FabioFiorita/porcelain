import { describe, expect, it } from 'vitest'
import { createHubWorktree, openProject, removeRecentProject } from './project-mutations'

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
})
