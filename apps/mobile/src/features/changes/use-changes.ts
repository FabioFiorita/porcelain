import type { DiffReadingScope } from '@porcelain/client-runtime/git'
import { type FlowGroup, useGitFlow, useGitRangeFlow } from '@/features/git'

import { type ChangesScope, useChangesStore } from './changes-store'

/**
 * Review marks are Review-owned wire, read and written from the Changes surface that shows the
 * ticks. Bound to the canonical contract here; no schema is recreated.
 */

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

/** The scope the continuous "read all" surface reads — the store's scope in wire form. */
export function readingScopeFor(scope: ChangesScope): DiffReadingScope {
  return scope === 'branch' ? { type: 'branch' } : { type: 'working' }
}
