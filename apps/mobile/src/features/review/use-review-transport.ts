import { type ReviewQuery, reviewProjectKey } from '@porcelain/client-runtime/review'
import { keepPreviousData, type UseQueryResult, useQuery } from '@tanstack/react-query'

import { useActiveProject } from '@/features/projects'
import {
  type Environment,
  environmentActions,
  isPaired,
  useActiveEnvironment,
} from '@/features/remote'
import { getDaemonClient } from '@/lib/daemon/client'
import { DaemonError, daemonErrorMessage } from '@/lib/daemon/errors'
import { callDaemon, type DaemonProcedure, type DaemonQuery } from '@/lib/daemon/procedure'

import { reviewQueryKey } from './review-query-key'

/**
 * The project identity a Review read carries while no repository is open.
 *
 * Identities reject an empty project path, so a disabled read still needs a well-formed one;
 * this sentinel can never collide with a real checkout (`use-git-transport.ts` idiom).
 */
export const REVIEW_DISABLED_PROJECT = '/__porcelain-disabled-review__'

/**
 * The one Review transport seam. Reads and writes share it so a Review call cannot drift into
 * its own error translation or reachability bookkeeping — the connection banner is fed here.
 */
export async function callReview<TInput, TOutput>(
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

export type ReviewScope = {
  readonly environment: Environment | null
  readonly environmentId: string
  /** The normalized identity dimension — the sentinel while no project is open. */
  readonly projectPath: string
  /** The path the daemon is asked about; empty while no project is open. */
  readonly repoPath: string
  readonly ready: boolean
}

/** Environment + project, in the shape every Review read and write needs. */
export function useReviewScope(): ReviewScope {
  const environment = useActiveEnvironment()
  const project = useActiveProject()
  return {
    environment,
    environmentId: environment?.id ?? 'none',
    projectPath: project === null ? REVIEW_DISABLED_PROJECT : reviewProjectKey(project.path),
    ready: isPaired(environment) && project !== null,
    repoPath: project?.path ?? '',
  }
}

export type ReviewReadOptions = {
  readonly enabled: boolean
  readonly pollMs?: number
  readonly staleTime?: number
  readonly keepPreviousData?: boolean
}

/** Bind one exact Review identity to the cache and the daemon. */
export function useReviewQuery<TInput, TOutput>(
  query: ReviewQuery,
  procedure: DaemonQuery<TInput, TOutput>,
  input: TInput,
  options: ReviewReadOptions,
): UseQueryResult<TOutput, DaemonError> {
  const environment = useActiveEnvironment()
  const enabled = isPaired(environment) && options.enabled

  return useQuery<TOutput, DaemonError>({
    enabled,
    placeholderData: options.keepPreviousData === true ? keepPreviousData : undefined,
    queryFn: (): Promise<TOutput> => callReview(environment, procedure, input),
    queryKey: reviewQueryKey(environment?.id ?? 'none', query),
    refetchInterval: options.pollMs ?? false,
    staleTime: options.staleTime,
  })
}
