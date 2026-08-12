import { describe, expect, it } from 'vitest'
import {
  projectDirectoriesQuery,
  projectsQuerySchema,
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
  })
})
