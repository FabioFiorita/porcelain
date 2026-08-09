import { z } from 'zod'
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
])

export type PorcelainError = z.infer<typeof publicErrorSchema>
export type PublicErrorCode = PorcelainError['code']
