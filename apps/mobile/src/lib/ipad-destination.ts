import { create } from 'zustand'

/**
 * iPad sidebar selection. SplitView columns sit outside the Slot route tree, so
 * `usePathname` / `useSegments` are unreliable for the supplementary list — track
 * the destination the user last picked in the primary column instead.
 */
export type IPadDestination =
  | 'files'
  | 'changes'
  | 'history'
  | 'review'
  | 'board'
  | 'terminal'
  | 'settings'
  | 'repo'

type IPadDestinationState = {
  destination: IPadDestination
  setDestination: (destination: IPadDestination) => void
}

export const useIPadDestination = create<IPadDestinationState>((set) => ({
  destination: 'files',
  setDestination: (destination): void => {
    set({ destination })
  },
}))
