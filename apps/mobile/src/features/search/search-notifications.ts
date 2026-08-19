import {
  type SearchForeignDependency,
  searchNotificationEffects,
  searchProjectKey,
} from '@porcelain/client-runtime/search'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { FilesChange } from '@porcelain/contracts/files'
import type { SessionChange } from '@porcelain/contracts/session'
import { settleBackground } from '@porcelain/shared/background'
import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useHubRepoPath } from '@/features/projects'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { subscribeSessionChanges } from '@/lib/daemon/session'
import { applySearchForeignDependencies as applyTypedSearchForeignDependencies } from '@/lib/search-invalidation'
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
      return { kind: change.kind, paths: [...change.paths], projectPath: change.projectPath }
    default:
      return null
  }
}

export type ApplySearchNotificationOptions = {
  readonly queryClient: QueryClient
  readonly environmentId: string
  readonly activeProjectPath: string | null
}

export function applySearchNotification(
  notification: FilesChange,
  options: ApplySearchNotificationOptions,
): void {
  if (
    options.activeProjectPath === null ||
    searchProjectKey(notification.projectPath) !== searchProjectKey(options.activeProjectPath)
  ) {
    return
  }
  settleBackground(
    invalidateSearchEffects(
      options.queryClient,
      options.environmentId,
      searchNotificationEffects(notification),
    ),
    'notification',
  )
}

export function applySearchForeignDependencies(
  queryClient: QueryClient,
  environmentId: string,
  projectPath: string,
  dependencies: readonly SearchForeignDependency[],
): Promise<void> {
  return applyTypedSearchForeignDependencies(queryClient, environmentId, projectPath, dependencies)
}

export function applySearchFreshnessRequirement(
  requirement: FreshnessRequirement,
  options: Omit<ApplySearchNotificationOptions, 'activeProjectPath'>,
): void {
  if (requirement.scope.kind === 'session') {
    settleBackground(invalidateAllSearchQueries(options.queryClient), 'invalidation')
    return
  }
  settleBackground(
    invalidateSearchProjectQueries(
      options.queryClient,
      options.environmentId,
      requirement.scope.projectPath,
    ),
    'invalidation',
  )
}

/** The one mobile Search bridge, mounted beside the other domain bridges. */
export function SearchNotificationBridge(): null {
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? null
  const activeProjectPath = useHubRepoPath()
  const queryClient = useQueryClient()
  const paired = isPaired(environment)

  useEffect(() => {
    if (!paired || environmentId === null) return
    const options: ApplySearchNotificationOptions = {
      activeProjectPath,
      environmentId,
      queryClient,
    }
    return subscribeSessionChanges({
      onChange: (change) => {
        const notification = filesChangeFromSessionChange(change)
        if (notification !== null) applySearchNotification(notification, options)
      },
      onFreshnessRequired: (requirement) => {
        applySearchFreshnessRequirement(requirement, options)
      },
    })
  }, [activeProjectPath, environmentId, paired, queryClient])

  return null
}
