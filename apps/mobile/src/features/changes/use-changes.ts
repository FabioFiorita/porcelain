import type { DiffReadingScope } from '@porcelain/client-runtime/git'
import { reviewProcedures } from '@porcelain/contracts/review'
import { useMemo } from 'react'
import { type FlowGroup, useGitFlow, useGitRangeFlow } from '@/features/git'
import { useActiveProject } from '@/features/projects'
import { LIVE_POLL_MS } from '@/lib/daemon/poll'
import { namedContractMutation, namedContractQuery } from '@/lib/daemon/procedure'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'

import { type ChangesScope, useChangesStore } from './changes-store'

/**
 * Review marks are Review-owned wire, read and written from the Changes surface that shows the
 * ticks. Bound to the canonical contract here; no schema is recreated.
 */
const reviewedPathsProcedure = namedContractQuery('reviewedPaths', reviewProcedures.reviewedPaths)
const markReviewedProcedure = namedContractMutation('markReviewed', reviewProcedures.markReviewed)
const unmarkReviewedProcedure = namedContractMutation(
  'unmarkReviewed',
  reviewProcedures.unmarkReviewed,
)
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
 * Mark / unmark one file, or replace the whole reviewed set in a single write (the header's
 * bulk toggle — pass every path, or `[]` to clear). Each write invalidates the reviewed query
 * so the next poll cannot re-publish the pre-write list.
 */
export function useToggleReviewed(): {
  /** Total: React Query owns pending + error; safe at sync UI edges. */
  mark: (path: string) => void
  unmark: (path: string) => void
  setReviewed: (paths: string[]) => void
  isPending: boolean
  error: Error | null
} {
  const project = useActiveProject()
  const mark = useDaemonMutation(markReviewedProcedure, { invalidates: REVIEWED_INVALIDATIONS })
  const unmark = useDaemonMutation(unmarkReviewedProcedure, {
    invalidates: REVIEWED_INVALIDATIONS,
  })
  const setAll = useDaemonMutation(setReviewedProcedure, { invalidates: REVIEWED_INVALIDATIONS })

  return {
    error: mark.error ?? unmark.error ?? setAll.error,
    isPending: mark.isPending || unmark.isPending || setAll.isPending,
    // `mutate` is void and publishes failure on the mutation error field — never mutateAsync
    // at a React event edge (the framework ignores the returned Promise).
    mark: (path: string): void => {
      if (project === null) return
      mark.mutate({ path, repoPath: project.path })
    },
    setReviewed: (paths: string[]): void => {
      if (project === null) return
      setAll.mutate({ paths, repoPath: project.path })
    },
    unmark: (path: string): void => {
      if (project === null) return
      unmark.mutate({ path, repoPath: project.path })
    },
  }
}

/** The scope the continuous "read all" surface reads — the store's scope in wire form. */
export function readingScopeFor(scope: ChangesScope): DiffReadingScope {
  return scope === 'branch' ? { type: 'branch' } : { type: 'working' }
}
