import { z } from 'zod'
import { definePublicError } from '../errors/define-public-error'

/**
 * Files public-error members. Composed into ERR-001's `publicErrorSchema` union; procedure
 * declarations reference the codes only. Native EEXIST mapping is FIL-002.
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
