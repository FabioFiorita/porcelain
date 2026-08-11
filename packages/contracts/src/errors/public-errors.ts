import { z } from 'zod'
import {
  boardCardNotFoundErrorSchema,
  boardInvalidTitleErrorSchema,
  boardUnavailableErrorSchema,
} from '../board/board.errors'
import { filesAlreadyExistsErrorSchema } from '../files'
import {
  reviewCommentNotFoundErrorSchema,
  reviewUnavailableErrorSchema,
} from '../review/review.errors'
import { definePublicError } from './define-public-error'
import {
  authForbiddenErrorSchema,
  authUnauthenticatedErrorSchema,
  internalUnexpectedErrorSchema,
  requestInvalidErrorSchema,
  resourceNotFoundErrorSchema,
  resourceUnavailableErrorSchema,
  stateConflictErrorSchema,
} from './system-errors'

export const protocolUpdateRequiredErrorDetailsSchema = z
  .object({
    expected: z.number().int().nonnegative(),
    received: z.number().int().nonnegative().nullable(),
  })
  .strict()

export const protocolUpdateRequiredErrorSchema = definePublicError({
  code: 'protocol.update-required',
  category: 'conflict',
  retryable: false,
  details: protocolUpdateRequiredErrorDetailsSchema,
})

export const publicErrorSchema = z.discriminatedUnion('code', [
  requestInvalidErrorSchema,
  authUnauthenticatedErrorSchema,
  authForbiddenErrorSchema,
  resourceNotFoundErrorSchema,
  stateConflictErrorSchema,
  resourceUnavailableErrorSchema,
  internalUnexpectedErrorSchema,
  protocolUpdateRequiredErrorSchema,
  boardUnavailableErrorSchema,
  boardCardNotFoundErrorSchema,
  boardInvalidTitleErrorSchema,
  reviewUnavailableErrorSchema,
  reviewCommentNotFoundErrorSchema,
  filesAlreadyExistsErrorSchema,
])

export type PorcelainError = z.infer<typeof publicErrorSchema>
export type PublicErrorCode = PorcelainError['code']
