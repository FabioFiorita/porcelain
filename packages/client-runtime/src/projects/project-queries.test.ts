import { describe, expect, it } from 'vitest'
import {
  hubInventoryQuery,
  listCanvasesQuery,
  overlayQuery,
  projectDirectoriesQuery,
  projectsQuerySchema,
  readCanvasQuery,
  recentProjectsQuery,
} from './project-queries'

describe('Project query identities', () => {
  it('keeps the includeWorktrees result dimension in the recent identity', () => {
    expect(recentProjectsQuery()).toEqual({
      domain: 'projects',
      name: 'recent',
      includeWorktrees: false,
    })
    expect(recentProjectsQuery(true)).toEqual({
      domain: 'projects',
      name: 'recent',
      includeWorktrees: true,
    })
    expect(recentProjectsQuery()).not.toEqual(recentProjectsQuery(true))
  })

  it('preserves nullable and non-null directory roots', () => {
    expect(projectDirectoriesQuery(null)).toEqual({
      domain: 'projects',
      name: 'directories',
      path: null,
    })
    expect(projectDirectoriesQuery('/synthetic/projects')).toEqual({
      domain: 'projects',
      name: 'directories',
      path: '/synthetic/projects',
    })
  })

  it('rejects unknown fields and wrong identity values', () => {
    expect(
      projectsQuerySchema.safeParse({
        domain: 'projects',
        name: 'recent',
        includeWorktrees: false,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      projectsQuerySchema.safeParse({
        domain: 'projects',
        name: 'recent',
        includeWorktrees: 'false',
      }).success,
    ).toBe(false)
    expect(
      projectsQuerySchema.safeParse({ domain: 'projects', name: 'directories', path: 42 }).success,
    ).toBe(false)
    expect(hubInventoryQuery()).toEqual({ domain: 'projects', name: 'inventory' })
    expect(
      projectsQuerySchema.safeParse({ domain: 'projects', name: 'inventory', extra: true }).success,
    ).toBe(false)
  })

  it('builds the Canvas list identity scoped to one Project', () => {
    expect(listCanvasesQuery('proj-1')).toEqual({
      domain: 'projects',
      name: 'canvases',
      projectId: 'proj-1',
      worktreePath: null,
    })
    expect(listCanvasesQuery('proj-1')).not.toEqual(listCanvasesQuery('proj-2'))
  })

  it('builds the single-Canvas read identity', () => {
    expect(readCanvasQuery('proj-1', 'canvas-1')).toEqual({
      domain: 'projects',
      name: 'canvas',
      projectId: 'proj-1',
      canvasId: 'canvas-1',
      worktreePath: null,
    })
  })

  it('separates the same Canvas addressed through different checkouts', () => {
    expect(listCanvasesQuery('proj-1', '/repo-a')).not.toEqual(
      listCanvasesQuery('proj-1', '/repo-b'),
    )
    expect(listCanvasesQuery('proj-1', '/repo-a')).not.toEqual(listCanvasesQuery('proj-1'))
    expect(readCanvasQuery('proj-1', 'canvas-1', '/repo-a')).not.toEqual(
      readCanvasQuery('proj-1', 'canvas-1', '/repo-b'),
    )
    expect(readCanvasQuery('proj-1', 'canvas-1', '/repo-a').worktreePath).toBe('/repo-a')
  })

  it('builds the overlay identity from the checkout path alone', () => {
    expect(overlayQuery('/repo-a')).toEqual({
      domain: 'projects',
      name: 'overlay',
      path: '/repo-a',
    })
    expect(
      projectsQuerySchema.safeParse({ domain: 'projects', name: 'overlay', path: '' }).success,
    ).toBe(false)
  })

  it('rejects an empty Project or Canvas id on the Canvas identities', () => {
    expect(
      projectsQuerySchema.safeParse({
        domain: 'projects',
        name: 'canvases',
        projectId: '',
        worktreePath: null,
      }).success,
    ).toBe(false)
    expect(
      projectsQuerySchema.safeParse({
        domain: 'projects',
        name: 'canvas',
        projectId: 'proj-1',
        canvasId: '',
        worktreePath: null,
      }).success,
    ).toBe(false)
  })

  it('rejects a Canvas identity that omits or empties the checkout dimension', () => {
    expect(
      projectsQuerySchema.safeParse({ domain: 'projects', name: 'canvases', projectId: 'proj-1' })
        .success,
    ).toBe(false)
    expect(
      projectsQuerySchema.safeParse({
        domain: 'projects',
        name: 'canvases',
        projectId: 'proj-1',
        worktreePath: '',
      }).success,
    ).toBe(false)
  })
})
