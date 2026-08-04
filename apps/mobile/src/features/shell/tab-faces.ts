import { create } from 'zustand'

/**
 * Dual-face tabs for phone chrome. Faces live in memory — not the URL — so
 * opening Companion / project / branch / worktree sheets never snaps the tab bar
 * back to Files / Changes / Review.
 *
 * Re-tap the focused tab root to toggle. Tab bar label + icon follow this store.
 */
export type FilesTabFace = 'files' | 'search'
export type ChangesTabFace = 'changes' | 'history'
export type ReviewTabFace = 'review' | 'board'

export type DualTabSlot = 'files' | 'changes' | 'review'

type TabFacesState = {
  files: FilesTabFace
  changes: ChangesTabFace
  review: ReviewTabFace
  setFiles: (face: FilesTabFace) => void
  setChanges: (face: ChangesTabFace) => void
  setReview: (face: ReviewTabFace) => void
  toggleFiles: () => void
  toggleChanges: () => void
  toggleReview: () => void
}

export const useTabFaces = create<TabFacesState>()((set) => ({
  files: 'files',
  changes: 'changes',
  review: 'review',
  setFiles: (files) => {
    set({ files })
  },
  setChanges: (changes) => {
    set({ changes })
  },
  setReview: (review) => {
    set({ review })
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
  toggleReview: () => {
    set((state) => ({
      review: state.review === 'review' ? 'board' : 'review',
    }))
  },
}))
