import { useMemo } from 'react'
import { LIVE_POLL_MS } from '@/lib/daemon/poll'
import {
  type DiffReadingScope,
  type FlowGroup,
  gitFlowQuery,
  gitRangeFlowQuery,
  markReviewedMutation,
  reviewedPathsQuery,
  setReviewedMutation,
  unmarkReviewedMutation,
} from '@/lib/daemon/procedures/changes'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'

import { type ChangesScope, useChangesStore } from './changes-store'

export type ChangesFlow = {
  groups: FlowGroup[] | undefined
  /** The ref the branch scope is measured against; `undefined` in the working scope. */
  base: string | undefined
  isLoading: boolean
  error: Error | null
}

/**
 * The flow-grouped change set for the active scope. Both queries are declared because hooks
 * cannot be conditional; the inactive one is disabled, so only one is ever in flight.
 */
export function useChangesFlow(active: boolean): ChangesFlow {
  const repo = useActiveRepo()
  const scope = useChangesStore((state) => state.scope)
  const repoPath = repo?.path ?? ''
  const enabled = active && repo !== null

  const working = useDaemonQuery(gitFlowQuery, repoPath, {
    enabled: enabled && scope === 'working',
    placeholderData: 'keepPreviousData',
    pollMs: scope === 'working' ? LIVE_POLL_MS : undefined,
    staleTime: 0,
  })
  const branch = useDaemonQuery(gitRangeFlowQuery, repoPath, {
    enabled: enabled && scope === 'branch',
    placeholderData: 'keepPreviousData',
  })

  if (scope === 'branch') {
    return {
      base: branch.data?.base,
      error: branch.error,
      groups: branch.data?.groups,
      isLoading: branch.isLoading,
    }
  }
  return {
    base: undefined,
    error: working.error,
    groups: working.data,
    isLoading: working.isLoading,
  }
}

/**
 * The working-tree flow, whatever scope the list is reading.
 *
 * Staging and committing always act on the working tree — the branch range is committed
 * history and carries no staged/unstaged state at all — so the commit composer reads this
 * rather than the active scope's groups.
 */
export function useWorkingFlow(active: boolean): FlowGroup[] | undefined {
  const repo = useActiveRepo()
  const { data } = useDaemonQuery(gitFlowQuery, repo?.path ?? '', {
    enabled: active && repo !== null,
    placeholderData: 'keepPreviousData',
    pollMs: LIVE_POLL_MS,
    staleTime: 0,
  })
  return data
}

/**
 * Changed-file count for the tab-bar badge. Shares `gitFlow`'s cache entry with the list, so
 * this adds a read only while the tab is off screen — and React Query uses the shortest
 * interval among observers, so an open list still refreshes at the live rate.
 */
export function useChangedFileCount(): number {
  const repo = useActiveRepo()
  const { data } = useDaemonQuery(gitFlowQuery, repo?.path ?? '', {
    enabled: repo !== null,
    pollMs: 15_000,
  })
  return (data ?? []).reduce((count, group) => count + group.files.length, 0)
}

/** Repo-relative paths the user has ticked off. Reconciled daemon-side, so it polls too. */
export function useReviewedPaths(active: boolean): Set<string> {
  const repo = useActiveRepo()
  const { data } = useDaemonQuery(reviewedPathsQuery, repo?.path ?? '', {
    enabled: active && repo !== null,
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
  mark: (path: string) => Promise<void>
  unmark: (path: string) => Promise<void>
  setReviewed: (paths: string[]) => Promise<void>
  isPending: boolean
  error: Error | null
} {
  const repo = useActiveRepo()
  const mark = useDaemonMutation(markReviewedMutation, { invalidates: REVIEWED_INVALIDATIONS })
  const unmark = useDaemonMutation(unmarkReviewedMutation, { invalidates: REVIEWED_INVALIDATIONS })
  const setAll = useDaemonMutation(setReviewedMutation, { invalidates: REVIEWED_INVALIDATIONS })

  return {
    error: mark.error ?? unmark.error ?? setAll.error,
    isPending: mark.isPending || unmark.isPending || setAll.isPending,
    mark: async (path: string): Promise<void> => {
      if (repo === null) return
      await mark.mutateAsync({ path, repoPath: repo.path })
    },
    setReviewed: async (paths: string[]): Promise<void> => {
      if (repo === null) return
      await setAll.mutateAsync({ paths, repoPath: repo.path })
    },
    unmark: async (path: string): Promise<void> => {
      if (repo === null) return
      await unmark.mutateAsync({ path, repoPath: repo.path })
    },
  }
}

/** The scope the continuous "read all" surface reads — the store's scope in wire form. */
export function readingScopeFor(scope: ChangesScope): DiffReadingScope {
  return scope === 'branch' ? { type: 'branch' } : { type: 'working' }
}
