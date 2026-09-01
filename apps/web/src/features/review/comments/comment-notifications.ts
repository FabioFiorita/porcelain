import { reviewCommentNotificationEffects } from '@porcelain/client-runtime/review'
import type { ReviewChanged } from '@porcelain/contracts/review'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import {
  daemonScopeForEnvironment,
  liveEnvironmentSessions,
  useEnvironmentSessionsRevision,
} from '@renderer/lib/environment-sessions'
import { settleBackground } from '@shared/background'
import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { isReviewCommentsQueryKey, reviewCommentsQueryKey } from './comment-query-key'

/**
 * Review comments notification adapter (RVC-003).
 *
 * Accepts only a validated RVC-001 `review.changed` notification and maps RVC-002 effects
 * onto the Web QueryClient for the comments identity only. Other Review queries stay on
 * session-runtime until later Review client-runtime units.
 */

export type ApplyReviewCommentNotificationOptions = {
  readonly queryClient: QueryClient
  readonly daemon: DaemonScope
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
        queryKey: reviewCommentsQueryKey(options.daemon, identity),
        exact: true,
      }),
      'notification',
    )
  }
}

/** Invalidate every Review comments cache entry (session/project recovery, archive). */
export function invalidateAllReviewComments(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => isReviewCommentsQueryKey(query.queryKey),
  })
}

/**
 * Subscribe once to session change signals and apply comments-only Review notifications.
 * Mounted from AppShell; comments are no longer bulk-invalidated inside session-runtime's
 * live `review.changed` path.
 */
export function useReviewCommentNotificationSubscription(): void {
  const queryClient = useQueryClient()
  const daemon = useDaemonIdentity()
  const host = daemon.host
  const version = daemon.version
  const sessionRevision = useEnvironmentSessionsRevision()
  const sessions = useMemo(() => liveEnvironmentSessions(sessionRevision), [sessionRevision])

  useEffect(() => {
    const cleanups = sessions.map((entry) => {
      const daemonScope: DaemonScope = daemonScopeForEnvironment(
        entry.connectionId === null ? null : entry.environmentId,
        { host, version },
      )
      entry.session.start()
      return entry.session.onChange((change) => {
        if (change.kind !== 'review.changed') return
        applyReviewCommentNotification(
          { kind: 'review.changed', projectPath: change.projectPath },
          { queryClient, daemon: daemonScope },
        )
      })
    })
    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  }, [queryClient, host, sessions, version])
}
