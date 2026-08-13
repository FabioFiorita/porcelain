import { reviewNotificationEffects } from '@porcelain/client-runtime/review'
import type { ReviewChanged } from '@porcelain/contracts/review'
import type { SessionChange } from '@porcelain/contracts/session'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { type DaemonSession, primary } from '@renderer/lib/daemon'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { settleBackground } from '@shared/background'
import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { invalidateReviewEffects } from './review-query-filter'

/**
 * Web Review notification adapter (REV-007), following `features/board/board-notifications.ts`
 * and `comments/comment-notifications.ts`.
 *
 * Accepts only a validated `review.changed` notification and maps REV-006's effects onto the
 * Web QueryClient. Comments keep their own subscription and predicate; the Git consequences of
 * the same change belong to `features/git`'s bridge. Exported from the feature entry as
 * `applyReviewQueryNotification` so no Web file can import two different functions named
 * `applyReviewNotification`.
 */

export type ApplyReviewQueryNotificationOptions = {
  readonly daemon: DaemonScope
  readonly queryClient: QueryClient
}

function reviewChangeFromSessionChange(change: SessionChange): ReviewChanged | null {
  return change.kind === 'review.changed'
    ? { kind: 'review.changed', projectPath: change.projectPath }
    : null
}

/** Invalidate exactly the Review identities a Review change makes stale. */
export function applyReviewQueryNotification(
  notification: ReviewChanged,
  options: ApplyReviewQueryNotificationOptions,
): void {
  // Sync notification edge: settle in the background; query errors surface on refetch.
  settleBackground(
    invalidateReviewEffects(
      options.queryClient,
      options.daemon,
      reviewNotificationEffects(notification),
    ),
    'notification',
  )
}

/** Install the one Web Review notification adapter at the session boundary. */
export function useReviewNotificationSubscription(session: DaemonSession = primary): void {
  const queryClient = useQueryClient()
  const identity = useDaemonIdentity()
  const host = identity.host
  const version = identity.version

  useEffect(() => {
    const daemon: DaemonScope = { host, version }
    return session.onChange((change) => {
      const notification = reviewChangeFromSessionChange(change)
      if (notification !== null) {
        applyReviewQueryNotification(notification, { daemon, queryClient })
      }
    })
  }, [host, queryClient, session, version])
}
