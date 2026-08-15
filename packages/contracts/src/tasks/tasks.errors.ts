import { z } from 'zod'
import { definePublicError } from '../errors/define-public-error'

/**
 * Tasks public-error members. Composed into the `publicErrorSchema` union; procedure
 * declarations reference the codes only.
 */

export const tasksUnavailableErrorSchema = definePublicError({
  code: 'tasks.unavailable',
  category: 'unavailable',
  retryable: true,
})

export const tasksNotFoundErrorDetailsSchema = z.object({ taskId: z.uuid() }).strict()

export const tasksNotFoundErrorSchema = definePublicError({
  code: 'tasks.not-found',
  category: 'not-found',
  retryable: false,
  details: tasksNotFoundErrorDetailsSchema,
})

export const tasksInvalidTitleErrorDetailsSchema = z
  .object({
    reason: z.enum(['blank', 'too-long']),
    maxLength: z.literal(240),
  })
  .strict()

export const tasksInvalidTitleErrorSchema = definePublicError({
  code: 'tasks.invalid-title',
  category: 'invalid-request',
  retryable: false,
  details: tasksInvalidTitleErrorDetailsSchema,
})

/**
 * A Quick Add attachment the daemon refused to copy. `reason` is the human's next move:
 * a path outside the caller's reach, a missing file, something that is not a regular file,
 * or a file too large for the store.
 */
export const tasksAttachmentRejectedErrorDetailsSchema = z
  .object({
    reason: z.enum(['not-absolute', 'not-found', 'not-a-file', 'too-large', 'unsafe-name']),
  })
  .strict()

export const tasksAttachmentRejectedErrorSchema = definePublicError({
  code: 'tasks.attachment-rejected',
  category: 'invalid-request',
  retryable: false,
  details: tasksAttachmentRejectedErrorDetailsSchema,
})
