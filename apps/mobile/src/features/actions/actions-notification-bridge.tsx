import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { subscribeSessionChanges } from '@/lib/daemon/session'

import { applyActionsFreshnessRequirement, applyActionsNotification } from './actions-notifications'

/**
 * Subscribe once to the configured mobile daemon session and apply Actions notifications.
 * Mounted from `app/_layout.tsx` inside the daemon/query provider tree.
 */
export function ActionsNotificationBridge(): null {
  const queryClient = useQueryClient()
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? null

  useEffect(() => {
    if (environmentId === null) return
    return subscribeSessionChanges({
      onChange: (change) => {
        if (change.kind !== 'actions.changed') return
        applyActionsNotification(
          { kind: 'actions.changed', projectPath: change.projectPath },
          { queryClient, environmentId },
        )
      },
      onFreshnessRequired: (requirement) => {
        // DaemonProvider owns session-wide recovery through the environment key. Actions owns
        // its project-scoped identity, which procedure-name invalidation cannot address.
        applyActionsFreshnessRequirement(requirement, { queryClient, environmentId })
      },
    })
  }, [queryClient, environmentId])

  return null
}
