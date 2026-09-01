import { z } from 'zod'
import { definePublicError } from '../errors/define-public-error'

/**
 * Public errors owned by Review-comment operations.
 * Composed into the shared `publicErrorSchema`; procedure declarations reference codes only.
 */

export const reviewUnavailableErrorSchema = definePublicError({
  code: 'review.unavailable',
  category: 'unavailable',
  retryable: true,
})

export const reviewCommentNotFoundErrorDetailsSchema = z
  .object({
    commentId: z.string().min(1),
  })
  .strict()

export const reviewCommentNotFoundErrorSchema = definePublicError({
  code: 'review.comment-not-found',
  category: 'not-found',
  retryable: false,
  details: reviewCommentNotFoundErrorDetailsSchema,
})
