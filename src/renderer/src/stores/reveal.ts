import { create } from 'zustand'

interface RevealState {
  /**
   * Absolute path of the file OR folder the tree should expand down to, scroll
   * into view, and highlight. Set when something is opened from outside the tree
   * (Changes → Open file, or the Cmd+P finder picking a folder); the tree's
   * nodes derive their expansion/highlight from it. A folder target expands
   * itself too, so its contents show.
   */
  path: string | null
  reveal: (path: string) => void
}

export const useRevealStore = create<RevealState>((set) => ({
  path: null,
  reveal: (path) => set({ path }),
}))
