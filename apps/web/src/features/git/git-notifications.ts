import { gitNotificationEffects } from '@porcelain/client-runtime/git'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { GitChange } from '@porcelain/contracts/git'
import type { SessionChange } from '@porcelain/contracts/session'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { type DaemonSession, primary } from '@renderer/lib/daemon'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { settleBackground } from '@shared/background'
import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import {
  invalidateAllGitQueries,
  invalidateGitEffects,
  invalidateGitProject,
} from './git-query-filter'

export type ApplyGitNotificationOptions = {
  readonly daemon: DaemonScope
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
    invalidateGitEffects(options.queryClient, options.daemon, gitNotificationEffects(notification)),
    'notification',
  )
}

export function applyGitFreshnessRequirement(
  requirement: FreshnessRequirement,
  options: ApplyGitNotificationOptions,
): void {
  if (requirement.scope.kind === 'session') {
    settleBackground(invalidateAllGitQueries(options.queryClient), 'invalidation')
    return
  }
  settleBackground(
    invalidateGitProject(options.queryClient, options.daemon, requirement.scope.projectPath),
    'invalidation',
  )
}

/** Install the one Web Git notification/recovery adapter at the session boundary. */
export function useGitNotificationSubscription(session: DaemonSession = primary): void {
  const queryClient = useQueryClient()
  const daemonIdentity = useDaemonIdentity()
  const host = daemonIdentity.host
  const version = daemonIdentity.version

  useEffect(() => {
    const daemon: DaemonScope = { host, version }
    const options: ApplyGitNotificationOptions = { daemon, queryClient }
    const offChange = session.onChange((change) => {
      const gitNotification = gitChangeFromSessionChange(change)
      if (gitNotification !== null) applyGitNotification(gitNotification, options)
    })
    const offFreshness = session.onFreshnessRequired((requirement) => {
      applyGitFreshnessRequirement(requirement, options)
    })
    return () => {
      offChange()
      offFreshness()
    }
  }, [host, queryClient, session, version])
}
