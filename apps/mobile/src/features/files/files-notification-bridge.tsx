import type { FilesChange } from '@porcelain/contracts/files'
import type { SessionChange } from '@porcelain/contracts/session'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useHubRepoPath } from '@/features/projects'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { subscribeSessionChanges } from '@/lib/daemon/session'

import { applyFilesFreshnessRequirement, applyFilesNotification } from './files-notifications'

// Takes the whole SessionChange union: some kinds carry no `projectPath` at all
// (Project-scoped `actions.changed`, daemon-wide terminal signals), so a parameter shape
// that demanded one would silently exclude them from the union instead of returning null.
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

/** The single mobile Files bridge for tree and scope freshness. */
export function FilesNotificationBridge(): null {
  const queryClient = useQueryClient()
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? null
  const activeProjectPath = useHubRepoPath()
  const paired = isPaired(environment)

  useEffect(() => {
    if (!paired || environmentId === null) return
    return subscribeSessionChanges({
      onChange: (change) => {
        const notification = filesChangeFromSessionChange(change)
        if (notification === null) return
        applyFilesNotification(notification, {
          activeProjectPath,
          environmentId,
          queryClient,
        })
      },
      onFreshnessRequired: (requirement) => {
        applyFilesFreshnessRequirement(requirement, { environmentId, queryClient })
      },
    })
  }, [activeProjectPath, environmentId, paired, queryClient])

  return null
}
