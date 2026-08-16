import { gitNotificationEffects } from '@porcelain/client-runtime/git'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { GitChange } from '@porcelain/contracts/git'
import type { SessionChange } from '@porcelain/contracts/session'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonSession } from '@renderer/lib/daemon'
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
export function useGitNotificationSubscription(session?: DaemonSession): void {
  const queryClient = useQueryClient()
  const daemonIdentity = useDaemonIdentity()
  const host = daemonIdentity.host
  const version = daemonIdentity.version
  const sessionRevision = useEnvironmentSessionsRevision()
  const sessions = useMemo(() => liveEnvironmentSessions(sessionRevision), [sessionRevision])

  useEffect(() => {
    const ownedSessions =
      session === undefined
        ? sessions
        : [
            {
              environmentId: null,
              connectionId: null,
              session,
            },
          ]
    const cleanups = ownedSessions.map((entry) => {
      const daemon: DaemonScope = daemonScopeForEnvironment(
        entry.connectionId === null ? null : entry.environmentId,
        { host, version },
      )
      const options: ApplyGitNotificationOptions = { daemon, queryClient }
      entry.session.start()
      const offChange = entry.session.onChange((change) => {
        const gitNotification = gitChangeFromSessionChange(change)
        if (gitNotification !== null) applyGitNotification(gitNotification, options)
      })
      const offFreshness = entry.session.onFreshnessRequired((requirement) => {
        applyGitFreshnessRequirement(requirement, options)
      })
      return () => {
        offChange()
        offFreshness()
      }
    })
    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  }, [host, queryClient, session, sessions, version])
}
