import { actionsNotificationEffects } from '@porcelain/client-runtime/actions'
import type { ActionsChanged } from '@porcelain/contracts/actions'
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
import {
  actionsCacheKeyForIdentity,
  invalidateActionsIdentities,
  invalidateAllActionsQueries,
} from './actions-query-key'

/**
 * Actions notification adapter (ACT-003).
 *
 * Accepts only a validated `actions.changed` notification and maps ACT-002 effects
 * onto the Web QueryClient (list keys only; trust collapses). Session-runtime no longer owns this.
 */

export type ApplyActionsNotificationOptions = {
  readonly queryClient: QueryClient
  readonly daemon: DaemonScope
}

/** Invalidate exactly the project list identities an Actions change makes stale. */
export function applyActionsNotification(
  notification: ActionsChanged,
  options: ApplyActionsNotificationOptions,
): void {
  const identities = actionsNotificationEffects(notification)
  settleBackground(
    invalidateActionsIdentities(options.queryClient, options.daemon, identities),
    'notification',
  )
}

export { invalidateAllActionsQueries }

/**
 * Subscribe once to session change signals and apply Actions notifications.
 * Mounted from AppShell; Actions event handling no longer lives in session-runtime.
 */
export function useActionsNotificationSubscription(): void {
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
        if (change.kind !== 'actions.changed') return
        applyActionsNotification(
          { kind: 'actions.changed', projectId: change.projectId },
          { queryClient, daemon: daemonScope },
        )
      })
    })
    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  }, [host, queryClient, sessions, version])
}

/** @internal — expose collapse helper for tests that assert key shape. */
export function actionsNotificationListKey(
  daemon: DaemonScope,
  projectId: string,
): ReturnType<typeof actionsCacheKeyForIdentity> {
  return actionsCacheKeyForIdentity(daemon, {
    domain: 'actions',
    name: 'list',
    projectId,
  })
}
