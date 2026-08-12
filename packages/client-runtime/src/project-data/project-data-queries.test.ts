import { describe, expect, it } from 'vitest'
import {
  ProjectDataIdentityError,
  projectDataDispositionsQuery,
  projectDataLayersQuery,
  projectDataNotesQuery,
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
  it('isolates the four identities by name for the same project path', () => {
    expect(projectDataNotesQuery(PATH_A)).toEqual({
      domain: 'project-data',
      name: 'notes',
      projectPath: PATH_A,
    })
    expect(projectDataLayersQuery(PATH_A)).toEqual({
      domain: 'project-data',
      name: 'layers',
      projectPath: PATH_A,
    })
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
    expect(projectDataNotesQuery(PATH_A)).not.toEqual(projectDataLayersQuery(PATH_A))
    expect(projectDataNotesQuery(PATH_A)).not.toEqual(projectDataDispositionsQuery(PATH_A))
    expect(projectDataNotesQuery(PATH_A)).not.toEqual(projectDataVisibilityQuery(PATH_A))
    expect(projectDataLayersQuery(PATH_A)).not.toEqual(projectDataDispositionsQuery(PATH_A))
    expect(projectDataLayersQuery(PATH_A)).not.toEqual(projectDataVisibilityQuery(PATH_A))
    expect(projectDataDispositionsQuery(PATH_A)).not.toEqual(projectDataVisibilityQuery(PATH_A))
  })

  it('isolates the same identity name across project paths', () => {
    expect(projectDataNotesQuery(PATH_A)).not.toEqual(projectDataNotesQuery(PATH_B))
    expect(projectDataLayersQuery(PATH_A)).not.toEqual(projectDataLayersQuery(PATH_B))
    expect(projectDataDispositionsQuery(PATH_A)).not.toEqual(projectDataDispositionsQuery(PATH_B))
    expect(projectDataVisibilityQuery(PATH_A)).not.toEqual(projectDataVisibilityQuery(PATH_B))
  })

  it('throws ProjectDataIdentityError for empty project paths', () => {
    expect(() => projectDataNotesQuery('')).toThrow(ProjectDataIdentityError)
    expect(() => projectDataLayersQuery('')).toThrow(ProjectDataIdentityError)
    expect(() => projectDataDispositionsQuery('')).toThrow(ProjectDataIdentityError)
    expect(() => projectDataVisibilityQuery('')).toThrow(ProjectDataIdentityError)
  })
})

describe('projectDataQuerySchema', () => {
  it('accepts the identities their constructors produce', () => {
    expect(projectDataQuerySchema.safeParse(projectDataNotesQuery(PATH_A)).success).toBe(true)
    expect(projectDataQuerySchema.safeParse(projectDataLayersQuery(PATH_A)).success).toBe(true)
    expect(projectDataQuerySchema.safeParse(projectDataDispositionsQuery(PATH_A)).success).toBe(
      true,
    )
    expect(projectDataQuerySchema.safeParse(projectDataVisibilityQuery(PATH_A)).success).toBe(true)
  })

  it('rejects extra keys, empty path, and invented names such as readNotes', () => {
    expect(
      projectDataQuerySchema.safeParse({
        domain: 'project-data',
        name: 'notes',
        projectPath: PATH_A,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      projectDataQuerySchema.safeParse({
        domain: 'project-data',
        name: 'notes',
        projectPath: '',
      }).success,
    ).toBe(false)
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
