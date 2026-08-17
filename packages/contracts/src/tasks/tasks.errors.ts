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
 * An attachment the daemon refused to copy. `reason` is the human's next move: a path
 * outside the caller's reach, a missing file, something that is not a regular file, a
 * file too large for the store, a basename the store will not keep, or bytes that are
 * not valid base64.
 */
export const TASK_ATTACHMENT_REJECTED_REASONS = [
  'not-absolute',
  'not-found',
  'not-a-file',
  'too-large',
  'unsafe-name',
  'invalid-bytes',
] as const

export const tasksAttachmentRejectedErrorDetailsSchema = z
  .object({
    reason: z.enum(TASK_ATTACHMENT_REJECTED_REASONS),
  })
  .strict()

export const tasksAttachmentRejectedErrorSchema = definePublicError({
  code: 'tasks.attachment-rejected',
  category: 'invalid-request',
  retryable: false,
  details: tasksAttachmentRejectedErrorDetailsSchema,
})
