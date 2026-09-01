import { z } from 'zod'

/**
 * A Review change means Review-owned queries are stale; clients refetch the ones they have open.
 * One category is sufficient because changes under `.porcelain/active-review/` invalidate the same
 * query family. The notification is strict and scoped by `projectPath` because Review data is
 * repository-local companion state.
 */

export const REVIEW_CHANGE_KINDS = ['review.changed'] as const

export const reviewChangedSchema = z
  .object({
    kind: z.literal('review.changed'),
    projectPath: z.string().min(1),
  })
  .strict()
export type ReviewChanged = z.infer<typeof reviewChangedSchema>

export const reviewChangeSchema = z.discriminatedUnion('kind', [reviewChangedSchema])
export type ReviewChange = z.infer<typeof reviewChangeSchema>

/** Representative Review change values used by boundary tests and client mocks. */
export const reviewNotificationFixtures = {
  'review.changed': {
    kind: 'review.changed',
    projectPath: '/synthetic/repo',
  },
} as const
