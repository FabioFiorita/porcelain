import { gitNotificationEffects } from '@porcelain/client-runtime/git'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { GitChange } from '@porcelain/contracts/git'
import type { SessionChange } from '@porcelain/contracts/session'
import { settleBackground } from '@porcelain/shared/background'
import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { isPaired } from '@/lib/daemon/environment'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { subscribeSessionChanges } from '@/lib/daemon/session'

import { invalidateGitEffects } from './git-legacy-cache'
import { invalidateAllGitWorkspaceQueries } from './git-query-filter'

export type ApplyGitNotificationOptions = {
  readonly environmentId: string
  readonly queryClient: QueryClient
}

function gitChangeFromSessionChange(change: SessionChange): GitChange | null {
  return change.kind === 'git.working-tree-changed'
    ? { kind: 'git.working-tree-changed', projectPath: change.projectPath }
    : null
}

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

export function applyGitFreshnessRequirement(
  requirement: FreshnessRequirement,
  options: ApplyGitNotificationOptions,
): void {
  if (requirement.scope.kind === 'session') {
    settleBackground(invalidateAllGitWorkspaceQueries(options.queryClient), 'invalidation')
    return
  }
  applyGitNotification(
    { kind: 'git.working-tree-changed', projectPath: requirement.scope.projectPath },
    options,
  )
}

/** The one mobile Git notification/recovery bridge, mounted beside other domain bridges. */
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
        const notification = gitChangeFromSessionChange(change)
        if (notification !== null) applyGitNotification(notification, options)
      },
      onFreshnessRequired: (requirement) => {
        applyGitFreshnessRequirement(requirement, options)
      },
    })
  }, [environmentId, paired, queryClient])

  return null
}
