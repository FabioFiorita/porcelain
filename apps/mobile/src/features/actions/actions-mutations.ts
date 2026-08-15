import { actionsMutations, actionsProjectKey } from '@porcelain/client-runtime/actions'
import { useQueryClient } from '@tanstack/react-query'
import { useActiveEnvironment } from '@/features/remote'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { invalidateActionsIdentities } from './actions-query-key'
import { useActionsTarget } from './actions-target'
import { callActionsProcedure } from './use-actions-transport'

/**
 * Mobile Actions trust mutation (ACT-003). No CRUD API on mobile (never existed).
 * Success-only list-key invalidation — no procedure-name `'actions'` invalidation array.
 */

const trustProcedure = namedContractProcedure(
  actionsMutations.trust.procedureName,
  actionsMutations.trust.procedure,
)

/** Accept a command this daemon's machine has not run before. */
export function useTrustAction(): (id: string) => Promise<void> {
  const target = useActionsTarget()
  const environment = useActiveEnvironment()
  const queryClient = useQueryClient()

  return async (id: string): Promise<void> => {
    if (target === null) return
    const wire = { projectId: actionsProjectKey(target.projectId), ids: [id] }
    await callActionsProcedure(environment, trustProcedure, wire)
    if (environment === null) return
    await invalidateActionsIdentities(
      queryClient,
      environment.id,
      actionsMutations.trust.affectedQueries(wire),
    )
  }
}
