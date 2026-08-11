import { z } from 'zod'

/**
 * Review change notifications — the domain-owned replacement for the `feature-view`,
 * `comments`, `layers`, and `evidence` entries in `appEventSchema` (the deleted horizontal session protocol).
 *
 * Those four are one category here because the current publisher already fires them
 * together: a single write under `.porcelain/active-review/` emits the matching event plus
 * `evidence` plus `feature-view` (`apps/daemon/src/review/review-watch.ts`), so no consumer
 * can act on the distinction. A Review change makes Review-owned queries stale; the client
 * refetches the ones it has open. Strict, and scoped by `projectPath` because Review data
 * is repo-local companion state.
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
