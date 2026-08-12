import type { ActionView } from '@porcelain/contracts/actions'
import { actionsProcedures } from '@porcelain/contracts/actions'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useActiveProject } from '@/features/projects'
import { isPaired } from '@/lib/daemon/environment'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import type { DaemonError } from '@/lib/daemon/errors'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { actionsListKeyForProject } from './actions-query-key'
import { callActionsProcedure } from './use-actions-transport'

/**
 * Mobile Actions list read (ACT-003).
 *
 * Binds ACT-002 list identity + environment id. Filters `where === 'local'` —
 * a phone has no local daemon.
 */

const listActionsProcedure = namedContractProcedure('actions', actionsProcedures.actions)

const DISABLED_LIST = {
  domain: 'actions' as const,
  name: 'list' as const,
  projectPath: '/',
}

export function useActions(active: boolean): {
  actions: ActionView[]
  error: DaemonError | null
} {
  const project = useActiveProject()
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? 'none'
  const projectPath = project?.path ?? null
  const enabled = active && project !== null && isPaired(environment)

  const query = useQuery({
    enabled,
    queryKey: projectPath
      ? actionsListKeyForProject(environmentId, projectPath)
      : (['daemon', environmentId, DISABLED_LIST] as const),
    queryFn: async (): Promise<ActionView[]> => {
      if (projectPath === null) return []
      return callActionsProcedure(environment, listActionsProcedure, projectPath)
    },
  })

  // A phone has no local daemon, so local-only actions are not runnable here.
  const actions = useMemo(
    () => (query.data ?? []).filter((action) => action.where !== 'local'),
    [query.data],
  )

  if (!enabled) {
    return { actions: [], error: null }
  }

  return {
    actions,
    error: (query.error as DaemonError | null) ?? null,
  }
}
