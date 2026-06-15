import { create } from 'zustand'

interface RevealState {
  /**
   * Absolute path of the file the tree should expand down to, scroll into view,
   * and highlight. Set when a file is opened from outside the tree (Changes →
   * Open file); the tree's nodes derive their expansion/highlight from it.
   */
  path: string | null
  reveal: (path: string) => void
}

export const useRevealStore = create<RevealState>((set) => ({
  path: null,
  reveal: (path) => set({ path }),
}))
