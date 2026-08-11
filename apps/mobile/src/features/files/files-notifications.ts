import {
  FILES_FOREIGN_CONTENT_INDEX,
  FILES_FOREIGN_PATH_INDEX,
  FILES_FOREIGN_WORKING_TREE,
  filesNotificationEffects,
  filesNotificationForeignDependencies,
  filesProjectKey,
} from '@porcelain/client-runtime/files'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { FilesChange } from '@porcelain/contracts/files'
import { settleBackground } from '@porcelain/shared/background'
import type { QueryClient } from '@tanstack/react-query'

import { applyFilesForeignDependencies } from './files-foreign'
import { invalidateFilesEffects, invalidateFilesProjectQueries } from './files-query-filter'

export type ApplyFilesNotificationOptions = {
  readonly queryClient: QueryClient
  readonly environmentId: string
  readonly activeProjectPath: string | null
}

function applyForeign(
  queryClient: QueryClient,
  environmentId: string,
  dependencies: Parameters<typeof applyFilesForeignDependencies>[2],
): void {
  settleBackground(
    applyFilesForeignDependencies(queryClient, environmentId, dependencies),
    'notification',
  )
}

/** Apply a validated Files notification to the active project's typed identities. */
export function applyFilesNotification(
  notification: FilesChange,
  options: ApplyFilesNotificationOptions,
): void {
  if (options.activeProjectPath === null) return
  if (filesProjectKey(notification.projectPath) !== filesProjectKey(options.activeProjectPath))
    return

  settleBackground(
    invalidateFilesEffects(
      options.queryClient,
      options.environmentId,
      filesNotificationEffects(notification),
    ),
    'notification',
  )
  applyForeign(
    options.queryClient,
    options.environmentId,
    filesNotificationForeignDependencies(notification),
  )
}

/** Recover only the project named by a typed sequence-gap requirement. */
export function applyFilesFreshnessRequirement(
  requirement: FreshnessRequirement,
  options: Omit<ApplyFilesNotificationOptions, 'activeProjectPath'>,
): void {
  if (requirement.scope.kind !== 'project') return
  settleBackground(
    invalidateFilesProjectQueries(
      options.queryClient,
      options.environmentId,
      requirement.scope.projectPath,
    ),
    'invalidation',
  )
  applyForeign(options.queryClient, options.environmentId, [
    FILES_FOREIGN_WORKING_TREE,
    FILES_FOREIGN_PATH_INDEX,
    FILES_FOREIGN_CONTENT_INDEX,
  ])
}
