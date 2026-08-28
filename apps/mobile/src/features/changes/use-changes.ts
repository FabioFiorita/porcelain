import type { DiffReadingScope } from '@porcelain/client-runtime/git'
import { type FlowGroup, useGitFlow, useGitRangeFlow } from '@/features/git'
import { useHubRepoPath } from '@/features/projects'

import { type ChangesScope, useChangesStore } from './changes-store'

/**
 * Review marks are Review-owned wire, read and written from the Changes surface that shows the
 * ticks. Bound to the canonical contract here; no schema is recreated.
 */

export type ChangesFlow = {
  groups: FlowGroup[] | undefined
  /** The ref the branch scope is measured against; `undefined` in the working scope. */
  base: string | undefined
  defaultBase: string | undefined
  requestedBase: string | undefined
  isLoading: boolean
  error: Error | null
}

/**
 * The flow-grouped change set for the active scope. Both reads are declared because hooks
 * cannot be conditional; the inactive one is disabled, so only one is ever in flight.
 */
export function useChangesFlow(active: boolean): ChangesFlow {
  const scope = useChangesStore((state) => state.scope)
  const repoPath = useHubRepoPath()
  const requestedBase = useChangesStore((state) =>
    repoPath === null ? undefined : state.compareBases[repoPath],
  )
  const working = useGitFlow({ enabled: active && scope === 'working' })
  const branch = useGitRangeFlow({
    enabled: active && scope === 'branch',
    ...(requestedBase === undefined ? {} : { base: requestedBase }),
  })

  if (scope === 'branch') {
    return {
      base: branch.base,
      defaultBase: branch.defaultBase,
      error: branch.error,
      groups: branch.groups,
      isLoading: branch.isLoading,
      requestedBase,
    }
  }
  return {
    base: undefined,
    defaultBase: undefined,
    error: working.error,
    groups: working.groups,
    isLoading: working.isLoading,
    requestedBase: undefined,
  }
}

/** The scope the continuous "read all" surface reads — the store's scope in wire form. */
export function readingScopeFor(scope: ChangesScope): DiffReadingScope {
  return scope === 'branch' ? { type: 'branch' } : { type: 'working' }
}
