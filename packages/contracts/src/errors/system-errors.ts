import { z } from 'zod'
import { definePublicError } from './define-public-error'

export const PUBLIC_ERROR_CATEGORY_VALUES = [
  'invalid-request',
  'unauthenticated',
  'forbidden',
  'not-found',
  'conflict',
  'unavailable',
  'internal',
] as const

export const publicErrorCategorySchema = z.enum(PUBLIC_ERROR_CATEGORY_VALUES)
export type PublicErrorCategory = z.infer<typeof publicErrorCategorySchema>

export const requestInvalidErrorSchema = definePublicError({
  code: 'request.invalid',
  category: 'invalid-request',
  retryable: false,
})

export const authUnauthenticatedErrorSchema = definePublicError({
  code: 'auth.unauthenticated',
  category: 'unauthenticated',
  retryable: false,
})

export const authForbiddenErrorSchema = definePublicError({
  code: 'auth.forbidden',
  category: 'forbidden',
  retryable: false,
})

export const resourceNotFoundErrorSchema = definePublicError({
  code: 'resource.not-found',
  category: 'not-found',
  retryable: false,
})

export const stateConflictErrorSchema = definePublicError({
  code: 'state.conflict',
  category: 'conflict',
  retryable: false,
})

export const resourceUnavailableErrorSchema = definePublicError({
  code: 'resource.unavailable',
  category: 'unavailable',
  retryable: true,
})

export const internalUnexpectedErrorSchema = definePublicError({
  code: 'internal.unexpected',
  category: 'internal',
  retryable: false,
})
