import { z } from 'zod'
import { definePublicError } from '../errors/define-public-error'

/**
 * Board public-error members. Composed into ERR-001's `publicErrorSchema` union; procedure
 * declarations reference the codes only. No daemon formatting or HTTP mapping lives here.
 */

export const boardUnavailableErrorSchema = definePublicError({
  code: 'board.unavailable',
  category: 'unavailable',
  retryable: true,
})

export const boardCardNotFoundErrorDetailsSchema = z
  .object({
    cardId: z.uuid(),
  })
  .strict()

export const boardCardNotFoundErrorSchema = definePublicError({
  code: 'board.card-not-found',
  category: 'not-found',
  retryable: false,
  details: boardCardNotFoundErrorDetailsSchema,
})

export const boardInvalidTitleErrorDetailsSchema = z
  .object({
    reason: z.enum(['blank', 'too-long']),
    maxLength: z.literal(240),
  })
  .strict()

export const boardInvalidTitleErrorSchema = definePublicError({
  code: 'board.invalid-title',
  category: 'invalid-request',
  retryable: false,
  details: boardInvalidTitleErrorDetailsSchema,
})
