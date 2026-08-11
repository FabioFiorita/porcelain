import { gitNotificationEffects } from '@porcelain/client-runtime/git'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { GitChange } from '@porcelain/contracts/git'
import type { SessionChange } from '@porcelain/contracts/session'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { type DaemonSession, primary } from '@renderer/lib/daemon'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { settleBackground } from '@shared/background'
import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { type GitLegacyUtils, invalidateGitEffects } from './git-legacy-cache'
import { invalidateAllGitWorkspaceQueries, invalidateGitWorkspaceProject } from './git-query-filter'

export type ApplyGitNotificationOptions = {
  readonly daemon: DaemonScope
  readonly queryClient: QueryClient
  readonly utils: GitLegacyUtils
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
      options.daemon,
      options.utils,
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

/** Install the one Web Git notification/recovery adapter at the session boundary. */
export function useGitNotificationSubscription(session: DaemonSession = primary): void {
  const queryClient = useQueryClient()
  const daemonIdentity = useDaemonIdentity()
  const host = daemonIdentity.host
  const version = daemonIdentity.version
  const utils = trpc.useUtils()

  useEffect(() => {
    const daemon: DaemonScope = { host, version }
    const options: ApplyGitNotificationOptions = { daemon, queryClient, utils }
    const offChange = session.onChange((change) => {
      const notification = gitChangeFromSessionChange(change)
      if (notification !== null) applyGitNotification(notification, options)
    })
    const offFreshness = session.onFreshnessRequired((requirement) => {
      applyGitFreshnessRequirement(requirement, options)
    })
    return () => {
      offChange()
      offFreshness()
    }
  }, [host, queryClient, session, utils, version])
}

/** Keep the project-scoped recovery helper observable to direct adapter tests. */
export function invalidateGitProjectForRecovery(
  queryClient: QueryClient,
  daemon: DaemonScope,
  projectPath: string,
): Promise<void> {
  return invalidateGitWorkspaceProject(queryClient, daemon, projectPath)
}
