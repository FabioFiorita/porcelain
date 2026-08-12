import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useActiveEnvironment } from '@/features/remote'
import { subscribeSessionChanges } from '@/lib/daemon/session'

import { applyBoardFreshnessRequirement, applyBoardNotification } from './board-notifications'

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
      onFreshnessRequired: (requirement) => {
        // DaemonProvider owns session-wide recovery through the environment key. Board owns
        // its project-scoped identity, which procedure-name invalidation cannot address.
        applyBoardFreshnessRequirement(requirement, { queryClient, environmentId })
      },
    })
  }, [queryClient, environmentId])

  return null
}
