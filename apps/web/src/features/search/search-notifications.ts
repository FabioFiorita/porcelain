import {
  type SearchForeignDependency,
  type SearchQueryEffect,
  searchForeignDependencyEffects,
  searchNotificationEffects,
  searchProjectKey,
} from '@porcelain/client-runtime/search'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { FilesChange } from '@porcelain/contracts/files'
import type { SessionChange } from '@porcelain/contracts/session'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import {
  daemonScopeForEnvironment,
  liveEnvironmentSessions,
} from '@renderer/lib/environment-sessions'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { settleBackground } from '@shared/background'
import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import {
  invalidateAllSearchQueries,
  invalidateSearchEffects,
  invalidateSearchProjectQueries,
} from './search-query-filter'

function filesChangeFromSessionChange(change: SessionChange): FilesChange | null {
  switch (change.kind) {
    case 'files.scope-changed':
      return { kind: 'files.scope-changed', projectPath: change.projectPath }
    case 'files.tree-changed':
    case 'files.content-changed':
      return { kind: change.kind, paths: change.paths, projectPath: change.projectPath }
    default:
      return null
  }
}

export type ApplySearchNotificationOptions = {
  readonly queryClient: QueryClient
  readonly daemon: DaemonScope
  readonly activeProjectPath: string | null
}

export function applySearchEffects(
  effects: readonly SearchQueryEffect[],
  options: Pick<ApplySearchNotificationOptions, 'daemon' | 'queryClient'>,
  reason: 'notification' | 'invalidation',
): void {
  settleBackground(invalidateSearchEffects(options.queryClient, options.daemon, effects), reason)
}

export function applySearchNotification(
  notification: FilesChange,
  options: ApplySearchNotificationOptions,
): void {
  if (options.activeProjectPath === null) return
  if (searchProjectKey(notification.projectPath) !== searchProjectKey(options.activeProjectPath)) {
    return
  }
  applySearchEffects(searchNotificationEffects(notification), options, 'notification')
}

export function applySearchForeignDependencies(
  queryClient: QueryClient,
  daemon: DaemonScope,
  projectPath: string,
  dependencies: readonly SearchForeignDependency[],
): Promise<void> {
  return invalidateSearchEffects(
    queryClient,
    daemon,
    searchForeignDependencyEffects(projectPath, dependencies),
  )
}

export function applySearchFreshnessRequirement(
  requirement: FreshnessRequirement,
  options: Pick<ApplySearchNotificationOptions, 'daemon' | 'queryClient'>,
): void {
  if (requirement.scope.kind === 'session') {
    settleBackground(invalidateAllSearchQueries(options.queryClient), 'invalidation')
    return
  }
  settleBackground(
    invalidateSearchProjectQueries(
      options.queryClient,
      options.daemon,
      requirement.scope.projectPath,
    ),
    'invalidation',
  )
}

/** The Web Search owner of Search freshness and recovery. */
export function useSearchNotificationSubscription(): void {
  const queryClient = useQueryClient()
  const daemon = useDaemonIdentity()
  const host = daemon.host
  const version = daemon.version
  const activeProjectPath = useProjectSelectionStore((s) => s.project?.path ?? null)

  useEffect(() => {
    const cleanups = liveEnvironmentSessions().map((entry) => {
      const options: ApplySearchNotificationOptions = {
        // A notification from a secondary daemon is already scoped to its owner. The primary
        // selection guard remains useful to avoid refreshing an unrelated checkout.
        activeProjectPath: entry.connectionId === null ? activeProjectPath : null,
        daemon: daemonScopeForEnvironment(
          entry.connectionId === null ? null : entry.environmentId,
          { host, version },
        ),
        queryClient,
      }
      entry.session.start()
      const offChange = entry.session.onChange((change) => {
        const notification = filesChangeFromSessionChange(change)
        if (notification !== null) {
          applySearchNotification(notification, {
            ...options,
            activeProjectPath: options.activeProjectPath ?? notification.projectPath,
          })
        }
      })
      const offFreshness = entry.session.onFreshnessRequired((requirement) => {
        applySearchFreshnessRequirement(requirement, options)
      })
      return () => {
        offChange()
        offFreshness()
      }
    })
    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  }, [activeProjectPath, host, queryClient, version])
}
