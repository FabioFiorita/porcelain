import {
  projectDataProjectKey,
  projectDataVisibilityQuery,
} from '@porcelain/client-runtime/project-data'
import { projectDataProcedures } from '@porcelain/contracts/project-data'
import { useQuery } from '@tanstack/react-query'
import { useActiveProject } from '@/features/projects'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { projectDataQueryKey } from './project-data-query-key'
import { callProjectDataProcedure } from './use-project-data-transport'

/**
 * Mobile Project Data reads (PDT-003).
 *
 * Binds typed identities + environment id. Transport is namedContractProcedure
 * plus callDaemon — no local defineQuery descriptors.
 */

const visibilityProcedure = namedContractProcedure(
  'companionGitVisibility',
  projectDataProcedures.companionGitVisibility,
)

const DISABLED_VISIBILITY = {
  domain: 'project-data',
  name: 'visibility',
  projectPath: '/',
} as const

export function useCompanionGitVisibility(enabled: boolean): {
  hidden: boolean | undefined
  isPending: boolean
} {
  const project = useActiveProject()
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? 'none'
  const projectPath = project?.path ?? null
  const canRun = enabled && project !== null && isPaired(environment)

  const query = useQuery({
    enabled: canRun,
    queryKey: projectPath
      ? projectDataQueryKey(environmentId, projectDataVisibilityQuery(projectPath))
      : projectDataQueryKey(environmentId, DISABLED_VISIBILITY),
    queryFn: async (): Promise<{ hidden: boolean }> => {
      if (projectPath === null) return { hidden: false }
      return callProjectDataProcedure(
        environment,
        visibilityProcedure,
        projectDataProjectKey(projectPath),
      )
    },
  })

  return { hidden: query.data?.hidden, isPending: query.isPending }
}
