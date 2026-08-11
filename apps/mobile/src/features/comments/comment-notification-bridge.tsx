import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { subscribeSessionChanges } from '@/lib/daemon/session'

import {
  applyReviewCommentFreshnessRequirement,
  applyReviewCommentNotification,
} from './comment-notifications'

/**
 * Subscribe once to the configured mobile daemon session and apply Review comments
 * notifications. Mounted from `app/_layout.tsx` inside the daemon/query provider tree.
 */
export function ReviewCommentNotificationBridge(): null {
  const queryClient = useQueryClient()
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? null

  useEffect(() => {
    if (environmentId === null) return
    return subscribeSessionChanges({
      onChange: (change) => {
        if (change.kind !== 'review.changed') return
        applyReviewCommentNotification(
          { kind: 'review.changed', projectPath: change.projectPath },
          { queryClient, environmentId },
        )
      },
      onFreshnessRequired: (requirement) => {
        // DaemonProvider owns session-wide recovery through the environment key. Comments
        // own their project-scoped identity, which procedure-name invalidation cannot address.
        applyReviewCommentFreshnessRequirement(requirement, { queryClient, environmentId })
      },
    })
  }, [queryClient, environmentId])

  return null
}
