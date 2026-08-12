import { type GitWorkspaceQuery, gitProjectKey } from '@porcelain/client-runtime/git'
import {
  keepPreviousData,
  type UseQueryResult,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback } from 'react'
import { useActiveProject } from '@/features/projects'
import {
  type Environment,
  environmentActions,
  isPaired,
  useActiveEnvironment,
} from '@/features/remote'
import { getDaemonClient } from '@/lib/daemon/client'
import { DaemonError, daemonErrorMessage } from '@/lib/daemon/errors'
import { callDaemon, type DaemonProcedure } from '@/lib/daemon/procedure'

import { gitQueryKey } from './git-query-key'

/**
 * The project identity a Git read carries while no repository is open.
 *
 * Identities are strict about the project dimension, so a disabled read still needs a
 * well-formed one; this sentinel can never collide with a real checkout.
 */
export const DISABLED_PROJECT = '/__porcelain-disabled-git__'

/**
 * The one Git transport seam. Reads and writes share it so a Git call cannot drift into its own
 * error translation or reachability bookkeeping — the connection banner is fed from here.
 */
export async function callGit<TInput, TOutput>(
  environment: Environment | null,
  procedure: DaemonProcedure<TInput, TOutput>,
  input: TInput,
): Promise<TOutput> {
  if (!isPaired(environment)) {
    throw new DaemonError('unreachable', procedure.name, 'No daemon is paired with this device.')
  }
  try {
    const output = await callDaemon(getDaemonClient(environment), procedure, input)
    environmentActions.recordReachabilitySuccess(environment.id)
    return output
  } catch (error) {
    if (error instanceof DaemonError && error.kind === 'unreachable') {
      environmentActions.recordReachabilityFailure(environment.id, daemonErrorMessage(error))
    }
    throw error
  }
}

export type GitScope = {
  readonly environment: Environment | null
  readonly environmentId: string
  /** The normalized identity dimension — the sentinel while no project is open. */
  readonly projectPath: string
  /** The path the daemon is asked about; empty while no project is open. */
  readonly repoPath: string
  readonly ready: boolean
}

/** Environment + project, in the shape every Git read and write needs. */
export function useGitScope(): GitScope {
  const environment = useActiveEnvironment()
  const project = useActiveProject()
  return {
    environment,
    environmentId: environment?.id ?? 'none',
    projectPath: project === null ? DISABLED_PROJECT : gitProjectKey(project.path),
    ready: isPaired(environment) && project !== null,
    repoPath: project?.path ?? '',
  }
}

export type GitReadOptions = {
  readonly enabled: boolean
  readonly pollMs?: number
  readonly staleTime?: number
  readonly keepPreviousData?: boolean
}

/** Bind one exact Git identity to the cache and the daemon. */
export function useGitQuery<TInput, TOutput>(
  query: GitWorkspaceQuery,
  procedure: DaemonProcedure<TInput, TOutput>,
  input: TInput,
  options: GitReadOptions,
): UseQueryResult<TOutput, DaemonError> {
  const environment = useActiveEnvironment()
  const enabled = isPaired(environment) && options.enabled

  return useQuery<TOutput, DaemonError>({
    enabled,
    placeholderData: options.keepPreviousData === true ? keepPreviousData : undefined,
    queryFn: (): Promise<TOutput> => callGit(environment, procedure, input),
    queryKey: gitQueryKey(environment?.id ?? 'none', query),
    refetchInterval: options.pollMs ?? false,
    staleTime: options.staleTime,
  })
}

/**
 * One Git read, imperatively — for an action that needs data it is not rendering, such as
 * copying a commit's full message from a row menu. Shares the cache with the rendered reads.
 */
export function useGitFetch(): <TInput, TOutput>(
  query: GitWorkspaceQuery,
  procedure: DaemonProcedure<TInput, TOutput>,
  input: TInput,
) => Promise<TOutput> {
  const queryClient = useQueryClient()
  const environment = useActiveEnvironment()

  return useCallback(
    <TInput, TOutput>(
      query: GitWorkspaceQuery,
      procedure: DaemonProcedure<TInput, TOutput>,
      input: TInput,
    ): Promise<TOutput> =>
      queryClient.fetchQuery({
        queryFn: (): Promise<TOutput> => callGit(environment, procedure, input),
        queryKey: gitQueryKey(environment?.id ?? 'none', query),
      }),
    [environment, queryClient],
  )
}
