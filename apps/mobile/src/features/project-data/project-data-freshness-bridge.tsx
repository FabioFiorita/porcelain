import { settleBackground } from '@porcelain/shared/background'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useActiveEnvironment } from '@/features/remote'
import { subscribeSessionChanges } from '@/lib/daemon/session'

import { applyProjectDataFreshnessRequirement } from './project-data-freshness'

/**
 * Subscribe once to the configured mobile daemon session and apply Project Data freshness.
 * Mounted from `app/_layout.tsx` inside the daemon/query provider tree.
 */
export function ProjectDataFreshnessBridge(): null {
  const queryClient = useQueryClient()
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? null

  useEffect(() => {
    if (environmentId === null) return
    return subscribeSessionChanges({
      onChange: () => {},
      onFreshnessRequired: (requirement) => {
        settleBackground(
          applyProjectDataFreshnessRequirement(requirement, { queryClient, environmentId }),
          'invalidation',
        )
      },
    })
  }, [queryClient, environmentId])

  return null
}
