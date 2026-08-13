import type { DiffReadingScope } from '@porcelain/client-runtime/git'
import { reviewProcedures } from '@porcelain/contracts/review'
import type { QueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { type FlowGroup, useGitFlow, useGitRangeFlow } from '@/features/git'
import { useActiveProject } from '@/features/projects'
import { LIVE_POLL_MS } from '@/lib/daemon/poll'
import { namedContractMutation, namedContractQuery } from '@/lib/daemon/procedure'
import { daemonKeys, useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'

import { type ChangesScope, useChangesStore } from './changes-store'

/**
 * Review marks are Review-owned wire, read and written from the Changes surface that shows the
 * ticks. Bound to the canonical contract here; no schema is recreated.
 */
const reviewedPathsProcedure = namedContractQuery('reviewedPaths', reviewProcedures.reviewedPaths)
const setReviewedProcedure = namedContractMutation('setReviewed', reviewProcedures.setReviewed)

export type ChangesFlow = {
  groups: FlowGroup[] | undefined
  /** The ref the branch scope is measured against; `undefined` in the working scope. */
  base: string | undefined
  isLoading: boolean
  error: Error | null
}

/**
 * The flow-grouped change set for the active scope. Both reads are declared because hooks
 * cannot be conditional; the inactive one is disabled, so only one is ever in flight.
 */
export function useChangesFlow(active: boolean): ChangesFlow {
  const scope = useChangesStore((state) => state.scope)
  const working = useGitFlow({ enabled: active && scope === 'working' })
  const branch = useGitRangeFlow({ enabled: active && scope === 'branch' })

  if (scope === 'branch') {
    return {
      base: branch.base,
      error: branch.error,
      groups: branch.groups,
      isLoading: branch.isLoading,
    }
  }
  return {
    base: undefined,
    error: working.error,
    groups: working.groups,
    isLoading: working.isLoading,
  }
}

/** Repo-relative paths the user has ticked off. Reconciled daemon-side, so it polls too. */
export function useReviewedPaths(active: boolean): Set<string> {
  const project = useActiveProject()
  const { data } = useDaemonQuery(reviewedPathsProcedure, project?.path ?? '', {
    enabled: active && project !== null,
    pollMs: LIVE_POLL_MS,
    staleTime: 0,
  })
  return useMemo(() => new Set(data ?? []), [data])
}

/** Reviewed marks are content-keyed daemon-side, so a write can un-tick other files too. */
const REVIEWED_INVALIDATIONS = ['reviewedPaths'] as const

/**
 * Refresh the reviewed-marks cache entry this feature owns.
 *
 * The ticks are read here through `useDaemonQuery`, so their entry is still keyed by procedure
 * name rather than by a typed identity. Review's typed `reviewed-paths` effect forwards to this
 * helper instead of reaching into another feature's key, which keeps the one entry with exactly
 * one owner and keeps the procedure name inside it.
 */
export function invalidateReviewedPaths(
  queryClient: QueryClient,
  environmentId: string,
): Promise<void> {
  return queryClient
    .invalidateQueries({ queryKey: daemonKeys.procedure(environmentId, 'reviewedPaths') })
    .then(() => undefined)
}

/**
 * Set the reviewed state of exactly the named paths, in one write.
 *
 * One total call serves both edges: a row's tick passes its own path, the header's bulk
 * toggle passes every changed path. There is no per-path mark and unmark to keep in step
 * with it, and the bulk case stays a single atomic round trip rather than one per file.
 * Each write invalidates the reviewed query so the next poll cannot re-publish the
 * pre-write list.
 */
export function useToggleReviewed(): {
  /** Total: React Query owns pending + error; safe at sync UI edges. */
  setReviewed: (paths: readonly string[], reviewed: boolean) => void
  isPending: boolean
  error: Error | null
} {
  const project = useActiveProject()
  const write = useDaemonMutation(setReviewedProcedure, { invalidates: REVIEWED_INVALIDATIONS })

  return {
    error: write.error,
    isPending: write.isPending,
    // `mutate` is void and publishes failure on the mutation error field — never mutateAsync
    // at a React event edge (the framework ignores the returned Promise).
    setReviewed: (paths: readonly string[], reviewed: boolean): void => {
      // The wire refuses an empty path list; nothing to set is not a write.
      if (project === null || paths.length === 0) return
      write.mutate({ paths: [...paths], repoPath: project.path, reviewed })
    },
  }
}

/** The scope the continuous "read all" surface reads — the store's scope in wire form. */
export function readingScopeFor(scope: ChangesScope): DiffReadingScope {
  return scope === 'branch' ? { type: 'branch' } : { type: 'working' }
}
