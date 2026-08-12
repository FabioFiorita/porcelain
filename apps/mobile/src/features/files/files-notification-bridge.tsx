import type { FilesChange } from '@porcelain/contracts/files'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useActiveProject } from '@/features/projects'
import { isPaired } from '@/lib/daemon/environment'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { subscribeSessionChanges } from '@/lib/daemon/session'

import { applyFilesFreshnessRequirement, applyFilesNotification } from './files-notifications'

function filesChangeFromSessionChange(change: {
  kind: 'files.scope-changed' | 'files.tree-changed' | 'files.content-changed' | string
  projectPath: string
  paths?: readonly string[]
}): FilesChange | null {
  switch (change.kind) {
    case 'files.scope-changed':
      return { kind: 'files.scope-changed', projectPath: change.projectPath }
    case 'files.tree-changed':
    case 'files.content-changed':
      return {
        kind: change.kind === 'files.tree-changed' ? 'files.tree-changed' : 'files.content-changed',
        paths: [...(change.paths ?? [])],
        projectPath: change.projectPath,
      }
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
