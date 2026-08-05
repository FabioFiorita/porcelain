import { create } from 'zustand'

/** Which diff the tab reads: the live working tree, or the committed range vs the default branch. */
export type ChangesScope = 'working' | 'branch'

/**
 * What the viewer shows. `null` is the tab's resting state (phone shows the list, tablet an
 * empty viewer); `all` is the continuous stacked-diff read of the whole scope.
 */
export type ChangesSelection = { kind: 'file'; path: string } | { kind: 'all' } | null

type ChangesState = {
  scope: ChangesScope
  selection: ChangesSelection
  setScope: (scope: ChangesScope) => void
  openFile: (path: string) => void
  openAll: () => void
  closeSelection: () => void
}

/**
 * Changes view state — which scope is read and what the viewer holds.
 *
 * Selection lives here rather than in the URL because the tablet viewer is a SplitView slot
 * the route does not own, and the phone tab bar's dual faces are already store-driven. One
 * selection model across both form factors beats a router push on phone and a store on tablet.
 *
 * Deliberately not persisted: a diff you were reading before a cold start is stale by then,
 * and re-opening it would fire a daemon read before the environment has reconnected.
 */
export const useChangesStore = create<ChangesState>()((set) => ({
  scope: 'working',
  selection: null,
  setScope: (scope) => {
    // A path from the other scope may not exist there at all (an untracked file has no
    // committed range), so a scope switch returns to the list rather than a dead diff.
    set({ scope, selection: null })
  },
  openFile: (path) => {
    set({ selection: { kind: 'file', path } })
  },
  openAll: () => {
    set({ selection: { kind: 'all' } })
  },
  closeSelection: () => {
    set({ selection: null })
  },
}))
