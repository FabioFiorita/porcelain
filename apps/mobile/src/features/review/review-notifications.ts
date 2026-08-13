import { reviewNotificationEffects } from '@porcelain/client-runtime/review'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { ReviewChanged } from '@porcelain/contracts/review'
import type { SessionChange } from '@porcelain/contracts/session'
import { settleBackground } from '@porcelain/shared/background'
import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { isPaired, useActiveEnvironment } from '@/features/remote'
import { subscribeSessionChanges } from '@/lib/daemon/session'

import {
  invalidateAllReviewQueries,
  invalidateReviewEffects,
  invalidateReviewProject,
} from './review-query-filter'

export type ApplyReviewNotificationOptions = {
  readonly environmentId: string
  readonly queryClient: QueryClient
}

/**
 * The agent rewrote the active review: the reading, its documents, its evidence pack and the
 * archive list are all stale for that project. The cross-worktree inbox is a Git scan and the
 * Git consequences belong to `GitNotificationBridge`; comments belong to RVC-004's bridge.
 */
export function applyReviewNotification(
  notification: ReviewChanged,
  options: ApplyReviewNotificationOptions,
): void {
  settleBackground(
    invalidateReviewEffects(
      options.queryClient,
      options.environmentId,
      reviewNotificationEffects(notification),
    ),
    'notification',
  )
}

/**
 * Recovery the runtime asked for: a reconnect or replaced daemon invalidates every Review
 * identity; a sequence gap invalidates only the identities of the project that gapped.
 */
export function applyReviewFreshnessRequirement(
  requirement: FreshnessRequirement,
  options: ApplyReviewNotificationOptions,
): void {
  if (requirement.scope.kind === 'session') {
    settleBackground(
      invalidateAllReviewQueries(options.queryClient, options.environmentId),
      'invalidation',
    )
    return
  }
  settleBackground(
    invalidateReviewProject(
      options.queryClient,
      options.environmentId,
      requirement.scope.projectPath,
    ),
    'invalidation',
  )
}

function applySessionChange(change: SessionChange, options: ApplyReviewNotificationOptions): void {
  if (change.kind !== 'review.changed') return
  applyReviewNotification({ kind: 'review.changed', projectPath: change.projectPath }, options)
}

/** The one mobile Review notification/recovery bridge, mounted beside the other domain bridges. */
export function ReviewNotificationBridge(): null {
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? null
  const queryClient = useQueryClient()
  const paired = isPaired(environment)

  useEffect(() => {
    if (!paired || environmentId === null) return
    const options: ApplyReviewNotificationOptions = { environmentId, queryClient }
    return subscribeSessionChanges({
      onChange: (change) => {
        applySessionChange(change, options)
      },
      onFreshnessRequired: (requirement) => {
        applyReviewFreshnessRequirement(requirement, options)
      },
    })
  }, [environmentId, paired, queryClient])

  return null
}
