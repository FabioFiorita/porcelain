import type { FilesChange } from '@porcelain/contracts/files'
import type { SessionChange } from '@porcelain/contracts/session'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useActiveProject } from '@/features/projects'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { subscribeSessionChanges } from '@/lib/daemon/session'

import { applyFilesFreshnessRequirement, applyFilesNotification } from './files-notifications'

// Takes the whole SessionChange union: some kinds carry no `projectPath` at all
// (daemon-wide `tasks.changed`, Project-scoped `actions.changed`), so a parameter shape
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

/** The single mobile Files bridge, mounted beside Board and Review bridges. */
export function FilesNotificationBridge(): null {
  const queryClient = useQueryClient()
  const environment = useActiveEnvironment()
  const project = useActiveProject()
  const environmentId = environment?.id ?? null
  const activeProjectPath = project?.path ?? null
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
