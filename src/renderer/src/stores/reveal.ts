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
  /**
   * Drop the target once the leaf row has consumed it (scrolled into view and
   * highlighted). Without this the path lingers forever, so the next time the
   * Files tab remounts (a sidebar tab switch) the whole ancestor chain of the
   * last-revealed file re-expands — a folder appears to open itself.
   */
  clear: () => void
}

export const useRevealStore = create<RevealState>((set) => ({
  path: null,
  reveal: (path) => set({ path }),
  clear: () => set({ path: null }),
}))
