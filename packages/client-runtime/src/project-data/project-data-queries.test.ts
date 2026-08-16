import { describe, expect, it } from 'vitest'
import {
  ProjectDataIdentityError,
  projectDataDispositionsQuery,
  projectDataProjectKey,
  projectDataQuerySchema,
  projectDataVisibilityQuery,
} from './project-data-queries'

const PATH_A = '/synthetic/repo'
const PATH_B = '/synthetic/other'

describe('projectDataProjectKey', () => {
  it('returns the non-empty project path unchanged', () => {
    expect(projectDataProjectKey(PATH_A)).toBe(PATH_A)
    expect(projectDataProjectKey('/synthetic/repo/')).toBe('/synthetic/repo/')
  })

  it('throws ProjectDataIdentityError for an empty path', () => {
    expect(() => projectDataProjectKey('')).toThrow(ProjectDataIdentityError)
    expect(() => projectDataProjectKey('')).toThrow('project-data: project path must be non-empty')
  })
})

describe('Project Data query identities', () => {
  it('isolates the two identities by name for the same project path', () => {
    expect(projectDataDispositionsQuery(PATH_A)).toEqual({
      domain: 'project-data',
      name: 'dispositions',
      projectPath: PATH_A,
    })
    expect(projectDataVisibilityQuery(PATH_A)).toEqual({
      domain: 'project-data',
      name: 'visibility',
      projectPath: PATH_A,
    })
    expect(projectDataDispositionsQuery(PATH_A)).not.toEqual(projectDataVisibilityQuery(PATH_A))
  })

  it('isolates the same identity name across project paths', () => {
    expect(projectDataDispositionsQuery(PATH_A)).not.toEqual(projectDataDispositionsQuery(PATH_B))
    expect(projectDataVisibilityQuery(PATH_A)).not.toEqual(projectDataVisibilityQuery(PATH_B))
  })

  it('throws ProjectDataIdentityError for empty project paths', () => {
    expect(() => projectDataDispositionsQuery('')).toThrow(ProjectDataIdentityError)
    expect(() => projectDataVisibilityQuery('')).toThrow(ProjectDataIdentityError)
  })
})

describe('projectDataQuerySchema', () => {
  it('accepts the identities their constructors produce', () => {
    expect(projectDataQuerySchema.safeParse(projectDataDispositionsQuery(PATH_A)).success).toBe(
      true,
    )
    expect(projectDataQuerySchema.safeParse(projectDataVisibilityQuery(PATH_A)).success).toBe(true)
  })

  it('rejects extra keys, empty path, and invented names such as readNotes', () => {
    expect(
      projectDataQuerySchema.safeParse({
        domain: 'project-data',
        name: 'readNotes',
        projectPath: PATH_A,
      }).success,
    ).toBe(false)
    expect(
      projectDataQuerySchema.safeParse({
        domain: 'actions',
        name: 'notes',
        projectPath: PATH_A,
      }).success,
    ).toBe(false)
  })
})
