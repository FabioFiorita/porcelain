import { describe, expect, it } from 'vitest'
import {
  boardCardNotFoundErrorSchema,
  boardInvalidTitleErrorSchema,
  boardUnavailableErrorSchema,
} from '../board/board.errors'
import { filesAlreadyExistsErrorSchema } from '../files/files.errors'
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
import {
  reviewCommentNotFoundErrorSchema,
  reviewUnavailableErrorSchema,
} from '../review/review.errors'

const memberSchemas = {
  'request.invalid': requestInvalidErrorSchema,
  'auth.unauthenticated': authUnauthenticatedErrorSchema,
  'auth.forbidden': authForbiddenErrorSchema,
  'resource.not-found': resourceNotFoundErrorSchema,
  'state.conflict': stateConflictErrorSchema,
  'resource.unavailable': resourceUnavailableErrorSchema,
  'internal.unexpected': internalUnexpectedErrorSchema,
  'protocol.update-required': protocolUpdateRequiredErrorSchema,
  'board.unavailable': boardUnavailableErrorSchema,
  'board.card-not-found': boardCardNotFoundErrorSchema,
  'board.invalid-title': boardInvalidTitleErrorSchema,
  'review.unavailable': reviewUnavailableErrorSchema,
  'review.comment-not-found': reviewCommentNotFoundErrorSchema,
  'files.already-exists': filesAlreadyExistsErrorSchema,
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
  { code: 'board.unavailable', category: 'unavailable', retryable: true, hasDetails: false },
  { code: 'board.card-not-found', category: 'not-found', retryable: false, hasDetails: true },
  { code: 'board.invalid-title', category: 'invalid-request', retryable: false, hasDetails: true },
  { code: 'review.unavailable', category: 'unavailable', retryable: true, hasDetails: false },
  {
    code: 'review.comment-not-found',
    category: 'not-found',
    retryable: false,
    hasDetails: true,
  },
  {
    code: 'files.already-exists',
    category: 'conflict',
    retryable: false,
    hasDetails: true,
  },
] as const

describe('public error contracts', () => {
  it('exports the system, Board, Review, and Files public members and categories', () => {
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
      protocolUpdateRequiredErrorSchema.safeParse({
        ...updateRequired,
        details: { expected: -1, received: null },
      }).success,
    ).toBe(false)
    expect(
      protocolUpdateRequiredErrorSchema.safeParse({
        ...updateRequired,
        details: { expected: 2 },
      }).success,
    ).toBe(false)
  })

  it('gives Board card-not-found and invalid-title their required strict details', () => {
    const notFound = publicErrorFixtures['board.card-not-found']
    expect(boardCardNotFoundErrorSchema.parse(notFound).details).toEqual({
      cardId: '00000000-0000-4000-8000-000000000101',
    })
    expect(
      boardCardNotFoundErrorSchema.safeParse({
        ...notFound,
        details: { cardId: 'not-a-uuid' },
      }).success,
    ).toBe(false)

    const invalidTitle = publicErrorFixtures['board.invalid-title']
    expect(boardInvalidTitleErrorSchema.parse(invalidTitle).details).toEqual({
      reason: 'blank',
      maxLength: 240,
    })
    expect(
      boardInvalidTitleErrorSchema.parse({
        ...invalidTitle,
        details: { reason: 'too-long', maxLength: 240 },
      }).details.reason,
    ).toBe('too-long')
    expect(
      boardInvalidTitleErrorSchema.safeParse({
        ...invalidTitle,
        details: { reason: 'blank', maxLength: 100 },
      }).success,
    ).toBe(false)
  })

  it('gives Review comment-not-found its required non-empty commentId detail', () => {
    const notFound = publicErrorFixtures['review.comment-not-found']
    expect(reviewCommentNotFoundErrorSchema.parse(notFound).details).toEqual({
      commentId: 'comment-synthetic-001',
    })
    expect(
      reviewCommentNotFoundErrorSchema.safeParse({
        ...notFound,
        details: { commentId: '' },
      }).success,
    ).toBe(false)
    expect(
      reviewCommentNotFoundErrorSchema.safeParse({
        ...notFound,
        details: {},
      }).success,
    ).toBe(false)
  })

  it('gives Files already-exists its required non-empty path detail', () => {
    const alreadyExists = publicErrorFixtures['files.already-exists']
    expect(filesAlreadyExistsErrorSchema.parse(alreadyExists).details).toEqual({
      path: '/synthetic/repo/docs/empty.txt',
    })
    expect(
      filesAlreadyExistsErrorSchema.safeParse({
        ...alreadyExists,
        details: { path: '' },
      }).success,
    ).toBe(false)
    expect(
      filesAlreadyExistsErrorSchema.safeParse({
        ...alreadyExists,
        details: {},
      }).success,
    ).toBe(false)
    expect(
      filesAlreadyExistsErrorSchema.safeParse({
        ...alreadyExists,
        details: { path: '/synthetic/repo/docs/empty.txt', extra: true },
      }).success,
    ).toBe(false)
  })
})
