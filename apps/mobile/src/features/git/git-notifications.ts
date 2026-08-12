import { gitNotificationEffects, gitReviewNotificationEffects } from '@porcelain/client-runtime/git'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { GitChange } from '@porcelain/contracts/git'
import type { ReviewChanged } from '@porcelain/contracts/review'
import type { SessionChange } from '@porcelain/contracts/session'
import { settleBackground } from '@porcelain/shared/background'
import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { isPaired } from '@/lib/daemon/environment'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { subscribeSessionChanges } from '@/lib/daemon/session'

import {
  invalidateAllGitQueries,
  invalidateGitEffects,
  invalidateGitProject,
} from './git-query-filter'

export type ApplyGitNotificationOptions = {
  readonly environmentId: string
  readonly queryClient: QueryClient
}

/** A working-tree fact makes every derived read of that project stale — never a commit read. */
export function applyGitNotification(
  notification: GitChange,
  options: ApplyGitNotificationOptions,
): void {
  settleBackground(
    invalidateGitEffects(
      options.queryClient,
      options.environmentId,
      gitNotificationEffects(notification),
    ),
    'notification',
  )
}

/** Changed Review layers regroup the flows and stacked diffs Git renders. */
export function applyGitReviewNotification(
  notification: ReviewChanged,
  options: ApplyGitNotificationOptions,
): void {
  settleBackground(
    invalidateGitEffects(
      options.queryClient,
      options.environmentId,
      gitReviewNotificationEffects(notification),
    ),
    'notification',
  )
}

/**
 * Recovery the runtime asked for: a reconnect or replaced daemon invalidates every Git
 * identity (the daemon-scoped commit-model list included); a sequence gap invalidates only
 * the identities of the project that gapped.
 */
export function applyGitFreshnessRequirement(
  requirement: FreshnessRequirement,
  options: ApplyGitNotificationOptions,
): void {
  if (requirement.scope.kind === 'session') {
    settleBackground(
      invalidateAllGitQueries(options.queryClient, options.environmentId),
      'invalidation',
    )
    return
  }
  settleBackground(
    invalidateGitProject(options.queryClient, options.environmentId, requirement.scope.projectPath),
    'invalidation',
  )
}

function applySessionChange(change: SessionChange, options: ApplyGitNotificationOptions): void {
  if (change.kind === 'git.working-tree-changed') {
    applyGitNotification(
      { kind: 'git.working-tree-changed', projectPath: change.projectPath },
      options,
    )
    return
  }
  if (change.kind === 'review.changed') {
    applyGitReviewNotification({ kind: 'review.changed', projectPath: change.projectPath }, options)
  }
}

/** The one mobile Git notification/recovery bridge, mounted beside the other domain bridges. */
export function GitNotificationBridge(): null {
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? null
  const queryClient = useQueryClient()
  const paired = isPaired(environment)

  useEffect(() => {
    if (!paired || environmentId === null) return
    const options: ApplyGitNotificationOptions = { environmentId, queryClient }
    return subscribeSessionChanges({
      onChange: (change) => {
        applySessionChange(change, options)
      },
      onFreshnessRequired: (requirement) => {
        applyGitFreshnessRequirement(requirement, options)
      },
    })
  }, [environmentId, paired, queryClient])

  return null
}
