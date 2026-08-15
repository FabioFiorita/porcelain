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

const PROJECT_A = 'proj-alpha'
const PROJECT_B = 'proj-beta'

describe('actionsProjectKey', () => {
  it('returns the non-empty project id unchanged', () => {
    expect(actionsProjectKey(PROJECT_A)).toBe(PROJECT_A)
    expect(actionsProjectKey('01JD9Z0000000000000000')).toBe('01JD9Z0000000000000000')
  })

  it('throws ActionsIdentityError for an empty id', () => {
    expect(() => actionsProjectKey('')).toThrow(ActionsIdentityError)
    expect(() => actionsProjectKey('')).toThrow('actions: project id must be non-empty')
  })
})

describe('actionsQuery / actionTrustQuery', () => {
  it('produces equal list identities for the same Project id', () => {
    expect(actionsQuery(PROJECT_A)).toEqual(actionsQuery(PROJECT_A))
    expect(actionsQuery(PROJECT_A)).toEqual({
      domain: 'actions',
      name: 'list',
      projectId: PROJECT_A,
    })
  })

  it('produces equal trust identities for the same Project id', () => {
    expect(actionTrustQuery(PROJECT_A)).toEqual(actionTrustQuery(PROJECT_A))
    expect(actionTrustQuery(PROJECT_A)).toEqual({
      domain: 'actions',
      name: 'trust',
      projectId: PROJECT_A,
    })
  })

  it('keeps list and trust product-distinct for the same id', () => {
    expect(actionsQuery(PROJECT_A)).not.toEqual(actionTrustQuery(PROJECT_A))
    expect(actionsQuery(PROJECT_A).name).toBe('list')
    expect(actionTrustQuery(PROJECT_A).name).toBe('trust')
  })

  it('produces distinct identities for different Project ids', () => {
    expect(actionsQuery(PROJECT_A)).not.toEqual(actionsQuery(PROJECT_B))
    expect(actionTrustQuery(PROJECT_A)).not.toEqual(actionTrustQuery(PROJECT_B))
    expect(actionsQuery(PROJECT_A).projectId).toBe(PROJECT_A)
    expect(actionsQuery(PROJECT_B).projectId).toBe(PROJECT_B)
  })

  it('throws ActionsIdentityError for empty project ids', () => {
    expect(() => actionsQuery('')).toThrow(ActionsIdentityError)
    expect(() => actionTrustQuery('')).toThrow(ActionsIdentityError)
  })
})

describe('actionsQuerySchema / actionTrustQuerySchema / actionsIdentitySchema', () => {
  it('accepts the identities their constructors produce', () => {
    expect(actionsQuerySchema.safeParse(actionsQuery(PROJECT_A)).success).toBe(true)
    expect(actionTrustQuerySchema.safeParse(actionTrustQuery(PROJECT_A)).success).toBe(true)
    expect(actionsIdentitySchema.safeParse(actionsQuery(PROJECT_A)).success).toBe(true)
    expect(actionsIdentitySchema.safeParse(actionTrustQuery(PROJECT_A)).success).toBe(true)
  })

  it('rejects empty id, a checkout-path field, wrong domain/name, and extra fields', () => {
    expect(
      actionsQuerySchema.safeParse({ domain: 'actions', name: 'list', projectId: '' }).success,
    ).toBe(false)
    expect(
      actionTrustQuerySchema.safeParse({ domain: 'actions', name: 'trust', projectId: '' }).success,
    ).toBe(false)
    // The path-keyed shape is gone: identities carry a Project id (ADR 0002), not a checkout.
    expect(
      actionsQuerySchema.safeParse({
        domain: 'actions',
        name: 'list',
        projectPath: '/synthetic/repo',
      }).success,
    ).toBe(false)
    expect(
      actionsQuerySchema.safeParse({ domain: 'board', name: 'list', projectId: PROJECT_A }).success,
    ).toBe(false)
    expect(
      actionsQuerySchema.safeParse({ domain: 'actions', name: 'trust', projectId: PROJECT_A })
        .success,
    ).toBe(false)
    expect(
      actionTrustQuerySchema.safeParse({ domain: 'actions', name: 'list', projectId: PROJECT_A })
        .success,
    ).toBe(false)
    expect(
      actionsQuerySchema.safeParse({
        domain: 'actions',
        name: 'list',
        projectId: PROJECT_A,
        extra: 1,
      }).success,
    ).toBe(false)
    expect(
      actionsIdentitySchema.safeParse({ domain: 'actions', name: 'cards', projectId: PROJECT_A })
        .success,
    ).toBe(false)
  })
})
