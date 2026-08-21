import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useActiveEnvironment } from '@/features/remote'
import { subscribeSessionChanges } from '@/lib/daemon/session'

import { applyTasksFreshnessRequirement, applyTasksNotification } from './tasks-notifications'

/**
 * Subscribe to the one live daemon session and refresh that Environment's Tasks table.
 *
 * The board reads every paired Environment, but a phone holds a SINGLE session socket — the
 * active Environment's — so only that daemon can push. The others refresh when the board is
 * remounted or refetched. Naming the active Environment on every invalidation is what keeps
 * that honest: a notification from one daemon must never mark another's table stale.
 *
 * Mounted from `app/_layout.tsx` inside the daemon/query provider tree.
 */
export function TasksNotificationBridge(): null {
  const queryClient = useQueryClient()
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? null

  useEffect(() => {
    if (environmentId === null) return
    return subscribeSessionChanges({
      onChange: (change) => {
        if (change.kind !== 'tasks.changed') return
        applyTasksNotification({ kind: 'tasks.changed' }, { queryClient, environmentId })
      },
      onFreshnessRequired: (requirement) => {
        applyTasksFreshnessRequirement(requirement, { queryClient, environmentId })
      },
    })
  }, [queryClient, environmentId])

  return null
}
