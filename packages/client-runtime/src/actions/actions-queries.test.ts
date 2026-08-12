import { describe, expect, it } from 'vitest'
import {
  ActionsIdentityError,
  actionsIdentitySchema,
  actionsProjectKey,
  actionsQuery,
  actionsQuerySchema,
  actionTrustQuery,
  actionTrustQuerySchema,
} from './actions-queries'

const PATH_A = '/synthetic/repo-a'
const PATH_B = '/synthetic/repo-b'

describe('actionsProjectKey', () => {
  it('returns the non-empty project path unchanged', () => {
    expect(actionsProjectKey(PATH_A)).toBe(PATH_A)
    expect(actionsProjectKey('/synthetic/repo-a/')).toBe('/synthetic/repo-a/')
  })

  it('throws ActionsIdentityError for an empty path', () => {
    expect(() => actionsProjectKey('')).toThrow(ActionsIdentityError)
    expect(() => actionsProjectKey('')).toThrow('actions: project path must be non-empty')
  })
})

describe('actionsQuery / actionTrustQuery', () => {
  it('produces equal list identities for the same Project path', () => {
    expect(actionsQuery(PATH_A)).toEqual(actionsQuery(PATH_A))
    expect(actionsQuery(PATH_A)).toEqual({
      domain: 'actions',
      name: 'list',
      projectPath: PATH_A,
    })
  })

  it('produces equal trust identities for the same Project path', () => {
    expect(actionTrustQuery(PATH_A)).toEqual(actionTrustQuery(PATH_A))
    expect(actionTrustQuery(PATH_A)).toEqual({
      domain: 'actions',
      name: 'trust',
      projectPath: PATH_A,
    })
  })

  it('keeps list and trust product-distinct for the same path', () => {
    expect(actionsQuery(PATH_A)).not.toEqual(actionTrustQuery(PATH_A))
    expect(actionsQuery(PATH_A).name).toBe('list')
    expect(actionTrustQuery(PATH_A).name).toBe('trust')
  })

  it('produces distinct identities for different Project paths', () => {
    expect(actionsQuery(PATH_A)).not.toEqual(actionsQuery(PATH_B))
    expect(actionTrustQuery(PATH_A)).not.toEqual(actionTrustQuery(PATH_B))
    expect(actionsQuery(PATH_A).projectPath).toBe(PATH_A)
    expect(actionsQuery(PATH_B).projectPath).toBe(PATH_B)
  })

  it('throws ActionsIdentityError for empty project paths', () => {
    expect(() => actionsQuery('')).toThrow(ActionsIdentityError)
    expect(() => actionTrustQuery('')).toThrow(ActionsIdentityError)
  })
})

describe('actionsQuerySchema / actionTrustQuerySchema / actionsIdentitySchema', () => {
  it('accepts the identities their constructors produce', () => {
    expect(actionsQuerySchema.safeParse(actionsQuery(PATH_A)).success).toBe(true)
    expect(actionTrustQuerySchema.safeParse(actionTrustQuery(PATH_A)).success).toBe(true)
    expect(actionsIdentitySchema.safeParse(actionsQuery(PATH_A)).success).toBe(true)
    expect(actionsIdentitySchema.safeParse(actionTrustQuery(PATH_A)).success).toBe(true)
  })

  it('rejects empty path, wrong domain/name, and extra fields', () => {
    expect(
      actionsQuerySchema.safeParse({ domain: 'actions', name: 'list', projectPath: '' }).success,
    ).toBe(false)
    expect(
      actionTrustQuerySchema.safeParse({ domain: 'actions', name: 'trust', projectPath: '' })
        .success,
    ).toBe(false)
    expect(
      actionsQuerySchema.safeParse({ domain: 'board', name: 'list', projectPath: PATH_A }).success,
    ).toBe(false)
    expect(
      actionsQuerySchema.safeParse({ domain: 'actions', name: 'trust', projectPath: PATH_A })
        .success,
    ).toBe(false)
    expect(
      actionTrustQuerySchema.safeParse({ domain: 'actions', name: 'list', projectPath: PATH_A })
        .success,
    ).toBe(false)
    expect(
      actionsQuerySchema.safeParse({
        domain: 'actions',
        name: 'list',
        projectPath: PATH_A,
        extra: 1,
      }).success,
    ).toBe(false)
    expect(
      actionsIdentitySchema.safeParse({ domain: 'actions', name: 'cards', projectPath: PATH_A })
        .success,
    ).toBe(false)
  })
})
