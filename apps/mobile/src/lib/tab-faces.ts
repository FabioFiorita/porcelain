import { create } from 'zustand'

/**
 * Primary vs alternate content for the two dual tabs. Faces live in memory — not the URL —
 * so opening Settings/Companion sheets never snaps the tab bar back to Review/Changes.
 *
 * Re-tap the focused tab root toggles the face. The tab bar label/icon follow this store.
 */
export type ReviewTabFace = 'review' | 'board'
export type ChangesTabFace = 'changes' | 'history'

type TabFacesState = {
  changes: ChangesTabFace
  review: ReviewTabFace
  setChanges: (face: ChangesTabFace) => void
  setReview: (face: ReviewTabFace) => void
  toggleChanges: () => void
  toggleReview: () => void
}

export const useTabFaces = create<TabFacesState>((set) => ({
  changes: 'changes',
  review: 'review',
  setChanges: (face): void => {
    set({ changes: face })
  },
  setReview: (face): void => {
    set({ review: face })
  },
  toggleChanges: (): void => {
    set((state) => ({
      changes: state.changes === 'changes' ? 'history' : 'changes',
    }))
  },
  toggleReview: (): void => {
    set((state) => ({
      review: state.review === 'review' ? 'board' : 'review',
    }))
  },
}))
