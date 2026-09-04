import { gitReviewPresentationEffect } from '@porcelain/client-runtime/git'
import type { ReviewCanvasChanged } from '@porcelain/contracts/review'
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
import { invalidateGitEffects } from '@renderer/features/git/git-query-filter'
import { SHELL_HUB_INVENTORIES_QUERY_KEY } from './hub-inventories'

/** Invalidate the announcing Environment's Hub source plus Electron's combined inventory. */
export function invalidateProjectsInventoryNotification(
  queryClient: QueryClient,
  environmentId: string | null,
): Promise<void> {
  return queryClient
    .invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey
        if (
          key.length === SHELL_HUB_INVENTORIES_QUERY_KEY.length &&
          key.every((value, index) => value === SHELL_HUB_INVENTORIES_QUERY_KEY[index])
        ) {
          return true
        }
        if (environmentId !== null) {
          return key[0] === 'browser' && key[1] === 'hubInventory' && key[2] === environmentId
        }
        const queryIdentity = key[0]
        return (
          typeof queryIdentity === 'object' &&
          queryIdentity !== null &&
          'domain' in queryIdentity &&
          'name' in queryIdentity &&
          queryIdentity.domain === 'projects' &&
          queryIdentity.name === 'hub-inventory'
        )
      },
    })
    .then(() => undefined)
}

/** Invalidate Canvas cache entries owned by the session that announced the write. */
export function invalidateCanvasNotification(
  notification: ReviewCanvasChanged,
  queryClient: QueryClient,
  environmentId: string | null,
  daemon?: DaemonScope,
): Promise<void> {
  return queryClient
    .invalidateQueries({
      predicate: (query) => {
        const identity = query.queryKey[0]
        const canvasMatch =
          typeof identity === 'object' &&
          identity !== null &&
          'domain' in identity &&
          'name' in identity &&
          'projectId' in identity &&
          identity.domain === 'projects' &&
          (identity.name === 'canvases' || identity.name === 'canvas') &&
          identity.projectId === notification.projectId &&
          query.queryKey[2] === environmentId
        const readinessMatch =
          typeof identity === 'object' &&
          identity !== null &&
          'domain' in identity &&
          'name' in identity &&
          'repoPath' in identity &&
          identity.domain === 'review' &&
          identity.name === 'readiness' &&
          identity.repoPath === notification.projectPath &&
          (daemon === undefined ||
            (typeof query.queryKey[1] === 'object' &&
              query.queryKey[1] !== null &&
              'host' in query.queryKey[1] &&
              'version' in query.queryKey[1] &&
              query.queryKey[1].host === daemon.host &&
              query.queryKey[1].version === daemon.version))
        return canvasMatch || readinessMatch
      },
    })
    .then(() => undefined)
}

/** One session subscription keeps Canvas lists and every Review reading scope fresh. */
export function useCanvasNotificationSubscription(): void {
  const queryClient = useQueryClient()
  const identity = useDaemonIdentity()
  const host = identity.host
  const version = identity.version
  const revision = useEnvironmentSessionsRevision()
  const sessions = useMemo(() => liveEnvironmentSessions(revision), [revision])

  useEffect(() => {
    const cleanups = sessions.map((entry) => {
      const daemon: DaemonScope = daemonScopeForEnvironment(
        entry.connectionId === null ? null : entry.environmentId,
        { host, version },
      )
      const environmentId = entry.connectionId === null ? null : entry.environmentId
      entry.session.start()
      return entry.session.onChange((change) => {
        if (change.kind === 'projects.inventory-changed') {
          settleBackground(
            invalidateProjectsInventoryNotification(queryClient, environmentId),
            'notification',
          )
          return
        }
        if (change.kind !== 'review.canvas-changed') return
        settleBackground(
          Promise.all([
            invalidateCanvasNotification(change, queryClient, environmentId, daemon),
            invalidateGitEffects(queryClient, daemon, [
              gitReviewPresentationEffect(change.projectPath),
            ]),
          ]).then(() => undefined),
          'notification',
        )
      })
    })
    return () =>
      cleanups.forEach((cleanup) => {
        cleanup()
      })
  }, [host, queryClient, sessions, version])
}
