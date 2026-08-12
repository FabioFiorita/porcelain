import { describe, expect, it } from 'vitest'
import {
  boardCardNotFoundErrorSchema,
  boardInvalidTitleErrorSchema,
  boardUnavailableErrorSchema,
} from '../board/board.errors'
import {
  filesAlreadyExistsErrorSchema,
  filesNotFoundErrorSchema,
  filesPathOutsideProjectErrorSchema,
} from '../files/files.errors'
import {
  authForbiddenErrorSchema,
  authUnauthenticatedErrorSchema,
  gitBranchAlreadyExistsErrorSchema,
  gitBranchNotFoundErrorSchema,
  gitNotARepositoryErrorSchema,
  gitWorkingTreeConflictErrorSchema,
  gitWorktreeConflictErrorSchema,
  internalUnexpectedErrorSchema,
  protocolUpdateRequiredErrorSchema,
  publicErrorCategorySchema,
  publicErrorFixtures,
  publicErrorSchema,
  requestInvalidErrorSchema,
  resourceNotFoundErrorSchema,
  resourceUnavailableErrorSchema,
  stateConflictErrorSchema,
  terminalCapacityErrorSchema,
  terminalExitedErrorSchema,
  terminalInvalidSizeErrorSchema,
  terminalNotFoundErrorSchema,
  terminalPasteUnavailableErrorSchema,
} from '../index'
import {
  projectsNotADirectoryErrorSchema,
  projectsNotFoundErrorSchema,
  projectsUnavailableErrorSchema,
} from '../projects/projects.errors'
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
  'projects.not-found': projectsNotFoundErrorSchema,
  'projects.not-a-directory': projectsNotADirectoryErrorSchema,
  'projects.unavailable': projectsUnavailableErrorSchema,
  'files.already-exists': filesAlreadyExistsErrorSchema,
  'files.path-outside-project': filesPathOutsideProjectErrorSchema,
  'files.not-found': filesNotFoundErrorSchema,
  'git.not-a-repository': gitNotARepositoryErrorSchema,
  'git.branch-not-found': gitBranchNotFoundErrorSchema,
  'git.branch-already-exists': gitBranchAlreadyExistsErrorSchema,
  'git.worktree-conflict': gitWorktreeConflictErrorSchema,
  'git.working-tree-conflict': gitWorkingTreeConflictErrorSchema,
  'terminal.not-found': terminalNotFoundErrorSchema,
  'terminal.exited': terminalExitedErrorSchema,
  'terminal.capacity': terminalCapacityErrorSchema,
  'terminal.invalid-size': terminalInvalidSizeErrorSchema,
  'terminal.paste-unavailable': terminalPasteUnavailableErrorSchema,
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
  { code: 'projects.not-found', category: 'not-found', retryable: false, hasDetails: false },
  {
    code: 'projects.not-a-directory',
    category: 'invalid-request',
    retryable: false,
    hasDetails: false,
  },
  { code: 'projects.unavailable', category: 'unavailable', retryable: true, hasDetails: false },
  {
    code: 'files.already-exists',
    category: 'conflict',
    retryable: false,
    hasDetails: true,
  },
  {
    code: 'files.path-outside-project',
    category: 'invalid-request',
    retryable: false,
    hasDetails: true,
  },
  {
    code: 'files.not-found',
    category: 'not-found',
    retryable: false,
    hasDetails: true,
  },
  { code: 'git.not-a-repository', category: 'not-found', retryable: false, hasDetails: false },
  { code: 'git.branch-not-found', category: 'not-found', retryable: false, hasDetails: false },
  {
    code: 'git.branch-already-exists',
    category: 'conflict',
    retryable: false,
    hasDetails: false,
  },
  { code: 'git.worktree-conflict', category: 'conflict', retryable: false, hasDetails: false },
  {
    code: 'git.working-tree-conflict',
    category: 'conflict',
    retryable: false,
    hasDetails: false,
  },
  { code: 'terminal.not-found', category: 'not-found', retryable: false, hasDetails: false },
  { code: 'terminal.exited', category: 'conflict', retryable: false, hasDetails: false },
  { code: 'terminal.capacity', category: 'unavailable', retryable: true, hasDetails: false },
  {
    code: 'terminal.invalid-size',
    category: 'invalid-request',
    retryable: false,
    hasDetails: false,
  },
  {
    code: 'terminal.paste-unavailable',
    category: 'unavailable',
    retryable: true,
    hasDetails: false,
  },
] as const

describe('public error contracts', () => {
  it('exports the system, Project, Board, Review, Files, Git, and Terminal public members and categories', () => {
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
      path: 'docs/empty.txt',
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
        details: { path: 'docs/empty.txt', extra: true },
      }).success,
    ).toBe(false)
  })

  it('gives Files path-outside-project invalid-request category and path detail', () => {
    const outside = publicErrorFixtures['files.path-outside-project']
    expect(filesPathOutsideProjectErrorSchema.parse(outside)).toMatchObject({
      code: 'files.path-outside-project',
      category: 'invalid-request',
      details: { path: 'outside-via-symlink' },
    })
    expect(
      filesPathOutsideProjectErrorSchema.safeParse({
        ...outside,
        details: { path: '' },
      }).success,
    ).toBe(false)
  })

  it('gives Files not-found its required non-empty path detail', () => {
    const notFound = publicErrorFixtures['files.not-found']
    expect(filesNotFoundErrorSchema.parse(notFound)).toMatchObject({
      code: 'files.not-found',
      category: 'not-found',
      details: { path: 'docs/missing.txt' },
    })
    expect(
      filesNotFoundErrorSchema.safeParse({
        ...notFound,
        details: { path: '' },
      }).success,
    ).toBe(false)
  })
})
