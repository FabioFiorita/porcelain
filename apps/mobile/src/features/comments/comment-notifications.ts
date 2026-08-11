import { reviewCommentNotificationEffects } from '@porcelain/client-runtime/review'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { ReviewChanged } from '@porcelain/contracts/review'
import { settleBackground } from '@porcelain/shared/background'
import type { QueryClient } from '@tanstack/react-query'

import { isReviewCommentsQueryKey, reviewCommentsQueryKeyForIdentity } from './comment-query-key'

/**
 * Review comments notification adapter (RVC-004).
 *
 * Accepts only a validated RVC-001 `review.changed` notification and maps RVC-002
 * effects onto the mobile QueryClient for the active environment. Does not inspect
 * raw AppEvent strings. Other Review queries stay on the provider bulk list.
 */

export type ApplyReviewCommentNotificationOptions = {
  readonly queryClient: QueryClient
  readonly environmentId: string
}

/** Invalidate exactly the Project comments identities a Review change makes stale. */
export function applyReviewCommentNotification(
  notification: ReviewChanged,
  options: ApplyReviewCommentNotificationOptions,
): void {
  for (const identity of reviewCommentNotificationEffects(notification)) {
    // Sync notification edge: settle in the background; query errors surface on refetch.
    settleBackground(
      options.queryClient.invalidateQueries({
        queryKey: reviewCommentsQueryKeyForIdentity(options.environmentId, identity),
        exact: true,
      }),
      'notification',
    )
  }
}

/** Recover the exact comments query when the session reports a project-scoped sequence gap. */
export function applyReviewCommentFreshnessRequirement(
  requirement: FreshnessRequirement,
  options: ApplyReviewCommentNotificationOptions,
): void {
  if (requirement.scope.kind !== 'project') return
  applyReviewCommentNotification(
    { kind: 'review.changed', projectPath: requirement.scope.projectPath },
    options,
  )
}

/**
 * Invalidate every Review comments cache entry for one environment (lifecycle writes after
 * publish/archive/restore/delete).
 */
export function invalidateAllReviewComments(
  queryClient: QueryClient,
  environmentId: string,
): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey
      return (
        Array.isArray(key) &&
        key[0] === 'daemon' &&
        key[1] === environmentId &&
        isReviewCommentsQueryKey(key)
      )
    },
  })
}
