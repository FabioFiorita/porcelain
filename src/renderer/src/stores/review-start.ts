import { create } from 'zustand'

/**
 * Optional suggested Review name when handing off from Board (Doing card) → Review.
 * Consumed by the empty canvas / start prompt so the title is prefilled once.
 * Client-only; not persisted.
 */
interface ReviewStartState {
  suggestedName: string | null
  setSuggestedName: (name: string | null) => void
  /** Read and clear in one step so a second open doesn't re-use a stale title. */
  consumeSuggestedName: () => string | null
}

export const useReviewStartStore = create<ReviewStartState>((set, get) => ({
  suggestedName: null,
  setSuggestedName: (name: string | null) => set({ suggestedName: name }),
  consumeSuggestedName: () => {
    const name = get().suggestedName
    set({ suggestedName: null })
    return name
  },
}))
