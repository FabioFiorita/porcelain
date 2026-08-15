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

export const actionsTargetInvalidErrorDetailsSchema = z
  .object({
    actionId: z.string().min(1),
  })
  .strict()

/**
 * The run target did not name a live Worktree of the Action's Project — the
 * daemon refuses rather than picking a checkout for the caller (#24).
 */
export const actionsTargetInvalidErrorSchema = definePublicError({
  code: 'actions.target-invalid',
  category: 'conflict',
  retryable: false,
  details: actionsTargetInvalidErrorDetailsSchema,
})
