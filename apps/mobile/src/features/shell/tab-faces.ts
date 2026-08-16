import { create } from 'zustand'

/**
 * Dual-face tabs for phone chrome. Faces live in memory — not the URL — so
 * opening Companion / project / branch / worktree sheets never snaps the tab bar
 * back to Files / Changes.
 *
 * Re-tap the focused tab root to toggle. Tab bar label + icon follow this store.
 */
export type FilesTabFace = 'files' | 'search'
export type ChangesTabFace = 'changes' | 'history'
export type DualTabSlot = 'files' | 'changes'

type TabFacesState = {
  files: FilesTabFace
  changes: ChangesTabFace
  setFiles: (face: FilesTabFace) => void
  setChanges: (face: ChangesTabFace) => void
  toggleFiles: () => void
  toggleChanges: () => void
}

export const useTabFaces = create<TabFacesState>()((set) => ({
  files: 'files',
  changes: 'changes',
  setFiles: (files) => {
    set({ files })
  },
  setChanges: (changes) => {
    set({ changes })
  },
  toggleFiles: () => {
    set((state) => ({
      files: state.files === 'files' ? 'search' : 'files',
    }))
  },
  toggleChanges: () => {
    set((state) => ({
      changes: state.changes === 'changes' ? 'history' : 'changes',
    }))
  },
}))
