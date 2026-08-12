import { describe, expect, it } from 'vitest'
import {
  terminalIdentitySchema,
  terminalSessionsQuery,
  terminalSessionsQuerySchema,
} from './terminal-queries'

describe('terminalSessionsQuery', () => {
  it('produces equal daemon-global sessions identities', () => {
    expect(terminalSessionsQuery()).toEqual(terminalSessionsQuery())
    expect(terminalSessionsQuery()).toEqual({
      domain: 'terminal',
      name: 'sessions',
    })
  })
})

describe('terminalSessionsQuerySchema / terminalIdentitySchema', () => {
  it('accepts the identity the constructor produces', () => {
    expect(terminalSessionsQuerySchema.safeParse(terminalSessionsQuery()).success).toBe(true)
    expect(terminalIdentitySchema.safeParse(terminalSessionsQuery()).success).toBe(true)
  })

  it('rejects wrong domain, name, extra fields, and a project path', () => {
    expect(
      terminalSessionsQuerySchema.safeParse({ domain: 'actions', name: 'sessions' }).success,
    ).toBe(false)
    expect(
      terminalSessionsQuerySchema.safeParse({ domain: 'terminal', name: 'list' }).success,
    ).toBe(false)
    expect(
      terminalSessionsQuerySchema.safeParse({
        domain: 'terminal',
        name: 'sessions',
        extra: 1,
      }).success,
    ).toBe(false)
    expect(
      terminalSessionsQuerySchema.safeParse({
        domain: 'terminal',
        name: 'sessions',
        projectPath: '/synthetic/repo',
      }).success,
    ).toBe(false)
  })
})
