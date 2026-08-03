import { create } from 'zustand'

/**
 * Primary vs alternate content for dual-face tabs. Faces live in memory — not the URL —
 * so opening Settings/Companion sheets never snaps the tab bar identity.
 *
 * Re-tap the focused tab root toggles the face. The tab bar label/icon follow this store.
 */
export type FilesTabFace = 'files' | 'search'
export type ReviewTabFace = 'review' | 'board'
export type ChangesTabFace = 'changes' | 'history'

type TabFacesState = {
  changes: ChangesTabFace
  files: FilesTabFace
  review: ReviewTabFace
  setChanges: (face: ChangesTabFace) => void
  setFiles: (face: FilesTabFace) => void
  setReview: (face: ReviewTabFace) => void
  toggleChanges: () => void
  toggleFiles: () => void
  toggleReview: () => void
}

export const useTabFaces = create<TabFacesState>((set) => ({
  changes: 'changes',
  files: 'files',
  review: 'review',
  setChanges: (face): void => {
    set({ changes: face })
  },
  setFiles: (face): void => {
    set({ files: face })
  },
  setReview: (face): void => {
    set({ review: face })
  },
  toggleChanges: (): void => {
    set((state) => ({
      changes: state.changes === 'changes' ? 'history' : 'changes',
    }))
  },
  toggleFiles: (): void => {
    set((state) => ({
      files: state.files === 'files' ? 'search' : 'files',
    }))
  },
  toggleReview: (): void => {
    set((state) => ({
      review: state.review === 'review' ? 'board' : 'review',
    }))
  },
}))
