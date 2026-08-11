import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { subscribeSessionChanges } from '@/lib/daemon/session'

import { applyBoardNotification } from './board-notifications'

/**
 * Subscribe once to the configured mobile daemon session and apply Board notifications.
 * Mounted from `app/_layout.tsx` inside the daemon/query provider tree.
 */
export function BoardNotificationBridge(): null {
  const queryClient = useQueryClient()
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? null

  useEffect(() => {
    if (environmentId === null) return
    return subscribeSessionChanges({
      onChange: (change) => {
        if (change.kind !== 'board.changed') return
        applyBoardNotification(
          { kind: 'board.changed', projectPath: change.projectPath },
          { queryClient, environmentId },
        )
      },
      onFreshnessRequired: () => {
        // Session/project recovery remains owned by DaemonProvider (environment-wide
        // invalidation). Board live signals alone are handled here.
      },
    })
  }, [queryClient, environmentId])

  return null
}
