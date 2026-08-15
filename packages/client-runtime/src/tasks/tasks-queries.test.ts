import { describe, expect, it } from 'vitest'
import { tasksTableQuery, tasksTableQuerySchema } from './tasks-queries'

const ENVIRONMENT_A = 'environment-a'
const ENVIRONMENT_B = 'environment-b'

describe('tasksTableQuery', () => {
  it('carries the Environment it was read from', () => {
    expect(tasksTableQuery(ENVIRONMENT_A)).toEqual({
      domain: 'tasks',
      name: 'table',
      environmentId: ENVIRONMENT_A,
    })
    expect(tasksTableQuery(ENVIRONMENT_A)).toEqual(tasksTableQuery(ENVIRONMENT_A))
  })

  it('defaults to the directly-connected daemon, which is not an Environment id', () => {
    expect(tasksTableQuery()).toEqual({ domain: 'tasks', name: 'table', environmentId: null })
    expect(tasksTableQuery(null)).toEqual(tasksTableQuery())
    expect(tasksTableQuery(null)).not.toEqual(tasksTableQuery(ENVIRONMENT_A))
  })

  it('never lets two Environments share one identity', () => {
    expect(tasksTableQuery(ENVIRONMENT_A)).not.toEqual(tasksTableQuery(ENVIRONMENT_B))
    expect(tasksTableQuery(ENVIRONMENT_A).environmentId).toBe(ENVIRONMENT_A)
    expect(tasksTableQuery(ENVIRONMENT_B).environmentId).toBe(ENVIRONMENT_B)
  })
})

describe('tasksTableQuerySchema', () => {
  it('accepts the identities its constructor produces, including the null Environment', () => {
    expect(tasksTableQuerySchema.safeParse(tasksTableQuery(ENVIRONMENT_A)).success).toBe(true)
    expect(tasksTableQuerySchema.safeParse(tasksTableQuery(null)).success).toBe(true)
  })

  it('rejects a key with no environmentId at all', () => {
    expect(tasksTableQuerySchema.safeParse({ domain: 'tasks', name: 'table' }).success).toBe(false)
    expect(
      tasksTableQuerySchema.safeParse({ domain: 'tasks', name: 'table', environmentId: undefined })
        .success,
    ).toBe(false)
  })

  it('rejects empty, non-string, and extra fields', () => {
    expect(
      tasksTableQuerySchema.safeParse({ domain: 'tasks', name: 'table', environmentId: '' })
        .success,
    ).toBe(false)
    expect(
      tasksTableQuerySchema.safeParse({ domain: 'tasks', name: 'table', environmentId: 7 }).success,
    ).toBe(false)
    expect(
      tasksTableQuerySchema.safeParse({
        domain: 'tasks',
        name: 'table',
        environmentId: ENVIRONMENT_A,
        projectPath: '/synthetic/repo',
      }).success,
    ).toBe(false)
  })

  it('rejects a foreign domain or name', () => {
    expect(
      tasksTableQuerySchema.safeParse({ domain: 'board', name: 'table', environmentId: null })
        .success,
    ).toBe(false)
    expect(
      tasksTableQuerySchema.safeParse({ domain: 'tasks', name: 'cards', environmentId: null })
        .success,
    ).toBe(false)
  })
})
