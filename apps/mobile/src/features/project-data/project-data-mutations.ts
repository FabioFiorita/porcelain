import { projectDataMutations, projectDataProjectKey } from '@porcelain/client-runtime/project-data'
import type { CompanionDispositionValue } from '@porcelain/contracts/project-data'
import { useQueryClient } from '@tanstack/react-query'
import { useInvalidateGitGrouping } from '@/features/git'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { invalidateProjectDataIdentities } from './project-data-query-key'
import { callProjectDataProcedure } from './use-project-data-transport'

/**
 * Mobile Project Data writes (PDT-003).
 *
 * Success-only typed identity invalidation.
 */

const setVisibilityProcedure = namedContractProcedure(
  projectDataMutations.setCompanionGitVisibility.procedureName,
  projectDataMutations.setCompanionGitVisibility.procedure,
)
const setDispositionProcedure = namedContractProcedure(
  projectDataMutations.setCompanionDisposition.procedureName,
  projectDataMutations.setCompanionDisposition.procedure,
)

export async function saveCompanionGitVisibility(
  environment: Parameters<typeof callProjectDataProcedure>[0],
  queryClient: ReturnType<typeof useQueryClient>,
  invalidateGrouping: (repoPath: string) => Promise<void>,
  repoPath: string,
  hidden: boolean,
): Promise<{ changed: boolean }> {
  const wire = { repoPath: projectDataProjectKey(repoPath), hidden }
  const result = await callProjectDataProcedure(environment, setVisibilityProcedure, wire)
  if (!isPaired(environment)) return result
  await invalidateProjectDataIdentities(
    queryClient,
    environment.id,
    projectDataMutations.setCompanionGitVisibility.affectedQueries(wire),
  )
  await invalidateGrouping(repoPath)
  return result
}

export async function saveCompanionDisposition(
  environment: Parameters<typeof callProjectDataProcedure>[0],
  queryClient: ReturnType<typeof useQueryClient>,
  invalidateGrouping: (repoPath: string) => Promise<void>,
  repoPath: string,
  key: string,
  disposition: CompanionDispositionValue,
): Promise<{ untracked: string[]; revealed: boolean }> {
  const wire = { repoPath: projectDataProjectKey(repoPath), key, disposition }
  const result = await callProjectDataProcedure(environment, setDispositionProcedure, wire)
  if (!isPaired(environment)) return result
  await invalidateProjectDataIdentities(
    queryClient,
    environment.id,
    projectDataMutations.setCompanionDisposition.affectedQueries(wire),
  )
  await invalidateGrouping(repoPath)
  return result
}

/** Hook wrapper used by settings writes. */
export function useProjectDataWrites(): {
  setVisibility: (repoPath: string, hidden: boolean) => Promise<{ changed: boolean }>
  setDisposition: (
    repoPath: string,
    key: string,
    disposition: CompanionDispositionValue,
  ) => Promise<{ untracked: string[]; revealed: boolean }>
} {
  const environment = useActiveEnvironment()
  const queryClient = useQueryClient()
  const invalidateGrouping = useInvalidateGitGrouping()
  return {
    setVisibility: (repoPath, hidden) =>
      saveCompanionGitVisibility(environment, queryClient, invalidateGrouping, repoPath, hidden),
    setDisposition: (repoPath, key, disposition) =>
      saveCompanionDisposition(
        environment,
        queryClient,
        invalidateGrouping,
        repoPath,
        key,
        disposition,
      ),
  }
}
