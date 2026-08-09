import { describe, expect, it } from 'vitest'
import {
  authForbiddenErrorSchema,
  authUnauthenticatedErrorSchema,
  internalUnexpectedErrorSchema,
  protocolUpdateRequiredErrorSchema,
  publicErrorCategorySchema,
  publicErrorFixtures,
  publicErrorSchema,
  requestInvalidErrorSchema,
  resourceNotFoundErrorSchema,
  resourceUnavailableErrorSchema,
  stateConflictErrorSchema,
} from '../index'

const memberSchemas = {
  'request.invalid': requestInvalidErrorSchema,
  'auth.unauthenticated': authUnauthenticatedErrorSchema,
  'auth.forbidden': authForbiddenErrorSchema,
  'resource.not-found': resourceNotFoundErrorSchema,
  'state.conflict': stateConflictErrorSchema,
  'resource.unavailable': resourceUnavailableErrorSchema,
  'internal.unexpected': internalUnexpectedErrorSchema,
  'protocol.update-required': protocolUpdateRequiredErrorSchema,
} as const

const expectedMembers = [
  { code: 'request.invalid', category: 'invalid-request', retryable: false, hasDetails: false },
  {
    code: 'auth.unauthenticated',
    category: 'unauthenticated',
    retryable: false,
    hasDetails: false,
  },
  { code: 'auth.forbidden', category: 'forbidden', retryable: false, hasDetails: false },
  { code: 'resource.not-found', category: 'not-found', retryable: false, hasDetails: false },
  { code: 'state.conflict', category: 'conflict', retryable: false, hasDetails: false },
  { code: 'resource.unavailable', category: 'unavailable', retryable: true, hasDetails: false },
  { code: 'internal.unexpected', category: 'internal', retryable: false, hasDetails: false },
  {
    code: 'protocol.update-required',
    category: 'conflict',
    retryable: false,
    hasDetails: true,
  },
] as const

describe('public error contracts', () => {
  it('exports exactly the eight fixed public members and categories', () => {
    expect(Object.keys(memberSchemas).sort()).toEqual(
      expectedMembers.map(({ code }) => code).sort(),
    )
    expect(publicErrorCategorySchema.options).toEqual([
      'invalid-request',
      'unauthenticated',
      'forbidden',
      'not-found',
      'conflict',
      'unavailable',
      'internal',
    ])

    for (const { code, category, retryable, hasDetails } of expectedMembers) {
      const fixture = publicErrorFixtures[code]
      const parsedMember = memberSchemas[code].parse(fixture)
      expect(parsedMember.code).toBe(code)
      expect(parsedMember.category).toBe(category)
      expect(parsedMember.retryable).toBe(retryable)
      expect('details' in parsedMember).toBe(hasDetails)
      expect(publicErrorSchema.parse(fixture)).toEqual(parsedMember)
    }
  })

  it('fixes every member retryability instead of deriving it from another field', () => {
    for (const { code, retryable } of expectedMembers) {
      expect(
        memberSchemas[code].safeParse({
          ...publicErrorFixtures[code],
          retryable: !retryable,
        }).success,
      ).toBe(false)
    }
  })

  it('requires every common field and rejects malformed, extra, and non-UUID values', () => {
    const requestInvalid = publicErrorFixtures['request.invalid']

    expect(
      publicErrorSchema.safeParse({
        code: requestInvalid.code,
        category: requestInvalid.category,
        retryable: requestInvalid.retryable,
        requestId: requestInvalid.requestId,
      }).success,
    ).toBe(false)
    expect(publicErrorSchema.safeParse({ ...requestInvalid, message: 12 }).success).toBe(false)
    expect(
      publicErrorSchema.safeParse({ ...requestInvalid, requestId: 'not-a-uuid' }).success,
    ).toBe(false)
    expect(publicErrorSchema.safeParse({ ...requestInvalid, category: 'forbidden' }).success).toBe(
      false,
    )
    expect(publicErrorSchema.safeParse({ ...requestInvalid, extra: true }).success).toBe(false)
    expect(publicErrorSchema.safeParse({ ...requestInvalid, details: {} }).success).toBe(false)
  })

  it('gives protocol updates their required strict integer details', () => {
    const updateRequired = publicErrorFixtures['protocol.update-required']

    expect(protocolUpdateRequiredErrorSchema.parse(updateRequired).details).toEqual({
      expected: 2,
      received: null,
    })
    expect(
      protocolUpdateRequiredErrorSchema.parse({
        ...updateRequired,
        details: { expected: 2, received: 1 },
      }).details,
    ).toEqual({ expected: 2, received: 1 })
    expect(
      protocolUpdateRequiredErrorSchema.safeParse({ ...updateRequired, details: undefined })
        .success,
    ).toBe(false)
    expect(
      protocolUpdateRequiredErrorSchema.safeParse({
        ...updateRequired,
        details: { expected: -1, received: 1 },
      }).success,
    ).toBe(false)
    expect(
      protocolUpdateRequiredErrorSchema.safeParse({
        ...updateRequired,
        details: { expected: 2, received: 1.5 },
      }).success,
    ).toBe(false)
    expect(
      protocolUpdateRequiredErrorSchema.safeParse({
        ...updateRequired,
        details: { expected: 2, received: '1' },
      }).success,
    ).toBe(false)
    expect(
      protocolUpdateRequiredErrorSchema.safeParse({
        ...updateRequired,
        details: { expected: 2, received: null, rawHeader: '2' },
      }).success,
    ).toBe(false)
  })
})
