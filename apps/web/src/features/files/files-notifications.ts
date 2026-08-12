import {
  type FilesForeignDependency,
  filesNotificationEffects,
  filesNotificationForeignDependencies,
  filesProjectKey,
} from '@porcelain/client-runtime/files'
import type { FilesChange } from '@porcelain/contracts/files'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { primary } from '@renderer/lib/daemon'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { settleBackground } from '@shared/background'
import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { applyFilesForeignDependencies } from './files-mutations'
import { invalidateAllFilesQueries, invalidateFilesEffects } from './files-query-filter'

/**
 * Files notification adapter (FIL-005).
 *
 * Accepts only validated files.* kinds and maps FIL-004 effects onto the Web QueryClient.
 */

export type ApplyFilesNotificationOptions = {
  readonly queryClient: QueryClient
  readonly daemon: DaemonScope
  readonly activeProjectPath: string | null
  /** Required: every accepted Files fact applies both Files and cross-domain freshness. */
  readonly applyForeignDependencies: (
    dependencies: readonly FilesForeignDependency[],
  ) => Promise<void>
}

/** Apply a typed Files change to the QueryClient (active-project + foreign tokens). */
export function applyFilesNotification(
  notification: FilesChange,
  options: ApplyFilesNotificationOptions,
): void {
  if (options.activeProjectPath === null) return
  if (filesProjectKey(notification.projectPath) !== filesProjectKey(options.activeProjectPath)) {
    return
  }
  // Sync notification edge: Files + foreign freshness stay best-effort; query surfaces refetch errors.
  settleBackground(
    invalidateFilesEffects(
      options.queryClient,
      options.daemon,
      filesNotificationEffects(notification),
    ),
    'notification',
  )
  settleBackground(
    options.applyForeignDependencies(
      filesNotificationForeignDependencies(notification).filter(
        (dependency) => dependency.domain === 'git',
      ),
    ),
    'notification',
  )
}

/** Invalidate every Files cache entry (session/project recovery). */
export function invalidateAllFiles(queryClient: QueryClient): Promise<void> {
  return invalidateAllFilesQueries(queryClient)
}

/**
 * Subscribe once to session change signals and apply Files notifications.
 * Mounted from AppShell; Files event handling no longer lives in session-runtime.
 */
export function useFilesNotificationSubscription(): void {
  const queryClient = useQueryClient()
  const daemon = useDaemonIdentity()
  const host = daemon.host
  const version = daemon.version
  const repoPath = useProjectSelectionStore((s) => s.project?.path ?? null)

  useEffect(() => {
    const daemonScope: DaemonScope = { host, version }
    return primary.onChange((change) => {
      // Kind guard: only the three Files kinds reach the mapper (Board pattern).
      let notification: FilesChange
      switch (change.kind) {
        case 'files.scope-changed':
          notification = { kind: 'files.scope-changed', projectPath: change.projectPath }
          break
        case 'files.tree-changed':
          notification = {
            kind: 'files.tree-changed',
            projectPath: change.projectPath,
            paths: change.paths,
          }
          break
        case 'files.content-changed':
          notification = {
            kind: 'files.content-changed',
            projectPath: change.projectPath,
            paths: change.paths,
          }
          break
        default:
          return
      }
      applyFilesNotification(notification, {
        queryClient,
        daemon: daemonScope,
        activeProjectPath: repoPath,
        applyForeignDependencies: (dependencies) =>
          applyFilesForeignDependencies(queryClient, daemonScope, repoPath, dependencies),
      })
    })
  }, [queryClient, host, version, repoPath])
}
