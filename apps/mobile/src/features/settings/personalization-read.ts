import { filesProfileQuery } from '@porcelain/client-runtime/files'
import { filesProcedures, type WorktreeProfileView } from '@porcelain/contracts/files'
import { useQuery } from '@tanstack/react-query'

import { getEnvironment, isPaired, useEnvironments } from '@/features/remote'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { filesQueryKey } from '../files/files-query-key'
import { callFilesQuery } from '../files/use-files-reads'

const worktreeProfileProcedure = namedContractProcedure(
  'worktreeProfile',
  filesProcedures.worktreeProfile,
)

export function useMobileWorktreeProfile(
  environmentId: string | null,
  projectPath: string | null,
): {
  profile: WorktreeProfileView | undefined
  error: Error | null
  isLoading: boolean
} {
  // Subscribe so pairing or removing the target environment refreshes this lookup.
  useEnvironments()
  const environment = environmentId === null ? null : getEnvironment(environmentId)
  const enabled = projectPath !== null && isPaired(environment)
  const query = useQuery({
    enabled,
    queryFn: async (): Promise<WorktreeProfileView> => {
      if (projectPath === null || !isPaired(environment)) {
        throw new Error('The project environment is not paired.')
      }
      return callFilesQuery(environment, worktreeProfileProcedure, projectPath)
    },
    queryKey:
      projectPath === null
        ? ['files', environmentId ?? 'none', 'profile', 'disabled']
        : filesQueryKey(environmentId ?? 'none', filesProfileQuery(projectPath)),
  })

  return {
    error: query.isError
      ? query.error instanceof Error
        ? query.error
        : new Error(String(query.error))
      : enabled
        ? null
        : new Error('The project environment is not paired.'),
    isLoading: enabled && query.isPending,
    profile: enabled ? query.data : undefined,
  }
}
