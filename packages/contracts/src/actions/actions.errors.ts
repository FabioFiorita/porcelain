import { z } from 'zod'
import { definePublicError } from '../errors/define-public-error'

/**
 * Actions public-error members. Composed into ERR-001's `publicErrorSchema` union; procedure
 * declarations reference the codes only. No daemon formatting or HTTP mapping lives here.
 */

export const actionsUnavailableErrorSchema = definePublicError({
  code: 'actions.unavailable',
  category: 'unavailable',
  retryable: true,
})

export const actionsNotFoundErrorDetailsSchema = z
  .object({
    actionId: z.string().min(1),
  })
  .strict()

export const actionsNotFoundErrorSchema = definePublicError({
  code: 'actions.not-found',
  category: 'not-found',
  retryable: false,
  details: actionsNotFoundErrorDetailsSchema,
})

export const actionsUntrustedErrorDetailsSchema = z
  .object({
    actionId: z.string().min(1),
  })
  .strict()

export const actionsUntrustedErrorSchema = definePublicError({
  code: 'actions.untrusted',
  category: 'conflict',
  retryable: false,
  details: actionsUntrustedErrorDetailsSchema,
})
