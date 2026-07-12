import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Per-repo commit-message drafts. The commit composer lives in Quick Access, which
 * unmounts on every sidebar-tab switch, so keeping the half-written message in the
 * composer's own `useState` silently destroyed it on switch (write a message, flip to
 * Files, come back → gone). This store outlives that unmount, and — because it persists —
 * the draft also survives a reload.
 *
 * Keyed by repo path: one window is one repo, but keying keeps repo switches safe (each
 * repo keeps its own in-flight message instead of bleeding into the next).
 */
interface CommitDraftState {
  messages: Record<string, string>
  setMessage: (repoPath: string, message: string) => void
  clearMessage: (repoPath: string) => void
}

export const useCommitDraftStore = create<CommitDraftState>()(
  persist(
    (set) => ({
      messages: {},
      setMessage: (repoPath, message) =>
        set((state) => ({ messages: { ...state.messages, [repoPath]: message } })),
      clearMessage: (repoPath) =>
        set((state) => {
          if (!(repoPath in state.messages)) return state
          const { [repoPath]: _removed, ...rest } = state.messages
          return { messages: rest }
        }),
    }),
    { name: 'porcelain-commit-drafts' },
  ),
)
