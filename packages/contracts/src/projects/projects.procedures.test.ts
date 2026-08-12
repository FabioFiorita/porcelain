import { describe, expect, it } from 'vitest'
import { projectsContractFixtures } from './projects.contract'
import { projectsProcedures } from './projects.procedures'

const expectedKinds = {
  openRepoPath: 'mutation',
  recentRepos: 'query',
  removeRecentRepo: 'mutation',
  browseDirs: 'query',
} as const

const expectedErrors = {
  openRepoPath: ['projects.not-found', 'projects.not-a-directory', 'projects.unavailable'],
  recentRepos: ['projects.unavailable'],
  removeRecentRepo: ['projects.unavailable'],
  browseDirs: ['projects.not-found', 'projects.not-a-directory', 'projects.unavailable'],
} as const

const invalidInputs = {
  openRepoPath: 42,
  recentRepos: { includeWorktrees: 'true' },
  removeRecentRepo: 42,
  browseDirs: 42,
} as const

const invalidOutputs = {
  openRepoPath: { path: '/synthetic/projects/alpha', name: 42 },
  recentRepos: [{ path: '/synthetic/projects/alpha', name: 42 }],
  removeRecentRepo: null,
  browseDirs: {
    path: '/synthetic/projects',
    parent: '/synthetic',
    entries: [{ name: 'alpha', path: '/synthetic/projects/alpha', isRepo: 'true' }],
  },
} as const

describe('Projects procedure contracts', () => {
  it('declares all four procedures with their router kinds', () => {
    expect(Object.keys(projectsProcedures).sort()).toEqual(Object.keys(expectedKinds).sort())
    for (const [name, kind] of Object.entries(expectedKinds)) {
      expect(projectsProcedures[name as keyof typeof projectsProcedures].kind).toBe(kind)
    }
  })

  it('declares the exact typed Project failures for each procedure', () => {
    for (const [name, errors] of Object.entries(expectedErrors)) {
      expect(projectsProcedures[name as keyof typeof projectsProcedures].errors).toEqual(errors)
    }
  })

  for (const name of Object.keys(projectsProcedures) as Array<keyof typeof projectsProcedures>) {
    it(`accepts valid ${name} input and output fixtures`, () => {
      const fixture = projectsContractFixtures[name]
      const procedure = projectsProcedures[name]
      expect(procedure.input.safeParse(fixture.input).success).toBe(true)
      expect(procedure.output.safeParse(fixture.output).success).toBe(true)
    })

    it(`rejects invalid ${name} input and output fixtures`, () => {
      const procedure = projectsProcedures[name]
      expect(procedure.input.safeParse(invalidInputs[name]).success).toBe(false)
      expect(procedure.output.safeParse(invalidOutputs[name]).success).toBe(false)
    })
  }

  it('preserves omitted and present recentRepos includeWorktrees values', () => {
    const input = projectsProcedures.recentRepos.input
    expect(input.safeParse(undefined).success).toBe(true)
    expect(input.safeParse({}).success).toBe(true)
    expect(input.parse({})).toEqual({ includeWorktrees: false })
    expect(input.safeParse({ includeWorktrees: false }).success).toBe(true)
    expect(input.safeParse({ includeWorktrees: true }).success).toBe(true)
  })

  it('accepts nullable and non-null browse roots and nullable output parents', () => {
    const procedure = projectsProcedures.browseDirs
    expect(procedure.input.safeParse(null).success).toBe(true)
    expect(procedure.input.safeParse('/synthetic/projects').success).toBe(true)
    expect(
      procedure.output.safeParse({
        path: '/',
        parent: null,
        entries: [],
      }).success,
    ).toBe(true)
  })

  it('rejects unknown fields at the Projects wire boundary', () => {
    expect(
      projectsProcedures.openRepoPath.output.safeParse({
        ...projectsContractFixtures.openRepoPath.output,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      projectsProcedures.recentRepos.input.safeParse({ includeWorktrees: true, extra: false })
        .success,
    ).toBe(false)
    expect(
      projectsProcedures.browseDirs.output.safeParse({
        ...projectsContractFixtures.browseDirs.output,
        entries: [
          {
            ...projectsContractFixtures.browseDirs.output.entries[0],
            extra: true,
          },
        ],
      }).success,
    ).toBe(false)
  })
})
