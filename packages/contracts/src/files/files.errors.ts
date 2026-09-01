import { z } from 'zod'
import { definePublicError } from '../errors/define-public-error'

/**
 * Files public-error members. Composed into the shared `publicErrorSchema`; procedure
 * declarations reference the codes only. Native errno mapping lives in the Files adapter.
 */

export const filesAlreadyExistsErrorDetailsSchema = z
  .object({
    path: z.string().min(1),
  })
  .strict()

export const filesAlreadyExistsErrorSchema = definePublicError({
  code: 'files.already-exists',
  category: 'conflict',
  retryable: false,
  details: filesAlreadyExistsErrorDetailsSchema,
})

export const filesPathOutsideProjectErrorDetailsSchema = z
  .object({
    /** Offending wire project-relative field (path / from / to). */
    path: z.string().min(1),
  })
  .strict()

export const filesPathOutsideProjectErrorSchema = definePublicError({
  code: 'files.path-outside-project',
  category: 'invalid-request',
  retryable: false,
  details: filesPathOutsideProjectErrorDetailsSchema,
})

export const filesNotFoundErrorDetailsSchema = z
  .object({
    path: z.string().min(1),
  })
  .strict()

export const filesNotFoundErrorSchema = definePublicError({
  code: 'files.not-found',
  category: 'not-found',
  retryable: false,
  details: filesNotFoundErrorDetailsSchema,
})
