import { create } from 'zustand'

/**
 * The Board → Review handoff: the card title a Review is about to be named after.
 *
 * "Start Review" on a card writes the title here and moves to the Review surface; the Review
 * reads it once with `consume()` and clears it, so a name is never applied twice and a Review
 * opened any other way stays untouched.
 *
 * Client-only and deliberately unpersisted — a suggestion that survived a cold start would
 * attach itself to whatever Review happened to open next.
 */
export const useReviewHandoffStore = create<{
  suggestedName: string | null
  suggest: (name: string) => void
  consume: () => string | null
}>()((set, get) => ({
  suggestedName: null,
  suggest: (name) => {
    const trimmed = name.trim()
    set({ suggestedName: trimmed === '' ? null : trimmed })
  },
  consume: () => {
    const name = get().suggestedName
    set({ suggestedName: null })
    return name
  },
}))
