import { projectDataMutations, projectDataProjectKey } from '@porcelain/client-runtime/project-data'
import type { CompanionDispositionValue, Layer } from '@porcelain/contracts/project-data'
import { useQueryClient } from '@tanstack/react-query'
import { useInvalidateGitGrouping } from '@/features/git'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { invalidateProjectDataIdentities } from './project-data-query-key'
import { callProjectDataProcedure } from './use-project-data-transport'

/**
 * Mobile Project Data writes (PDT-003).
 *
 * Success-only typed identity invalidation. Layers also regroup Git and refresh
 * leftover Review procedure keys (`activeReview`, `reviewReading`).
 */

const setLayersProcedure = namedContractProcedure(
  projectDataMutations.setRepoLayers.procedureName,
  projectDataMutations.setRepoLayers.procedure,
)
const setVisibilityProcedure = namedContractProcedure(
  projectDataMutations.setCompanionGitVisibility.procedureName,
  projectDataMutations.setCompanionGitVisibility.procedure,
)
const setDispositionProcedure = namedContractProcedure(
  projectDataMutations.setCompanionDisposition.procedureName,
  projectDataMutations.setCompanionDisposition.procedure,
)

export async function saveProjectLayers(
  environment: Parameters<typeof callProjectDataProcedure>[0],
  queryClient: ReturnType<typeof useQueryClient>,
  invalidateGrouping: (repoPath: string) => Promise<void>,
  repoPath: string,
  layers: readonly Layer[] | null,
): Promise<void> {
  const wire = {
    repoPath: projectDataProjectKey(repoPath),
    layers: layers === null ? null : layers.map(({ label, pattern }) => ({ label, pattern })),
  }
  await callProjectDataProcedure(environment, setLayersProcedure, wire)
  if (!isPaired(environment)) return
  await invalidateProjectDataIdentities(
    queryClient,
    environment.id,
    projectDataMutations.setRepoLayers.affectedQueries(wire),
  )
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ['daemon', environment.id, 'activeReview'],
    }),
    queryClient.invalidateQueries({
      queryKey: ['daemon', environment.id, 'reviewReading'],
    }),
  ])
  await invalidateGrouping(repoPath)
}

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

/** Hook wrapper used by settings writes that need grouping-after-write. */
export function useProjectDataWrites(): {
  saveLayers: (repoPath: string, layers: readonly Layer[] | null) => Promise<void>
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
    saveLayers: (repoPath, layers) =>
      saveProjectLayers(environment, queryClient, invalidateGrouping, repoPath, layers),
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
