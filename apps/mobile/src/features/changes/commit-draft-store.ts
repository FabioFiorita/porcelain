import { create } from 'zustand'

type CommitDraftState = {
  /** Message drafts keyed by repo path. */
  messages: Record<string, string>
  setMessage: (repoPath: string, message: string) => void
  clearMessage: (repoPath: string) => void
}

/**
 * Per-repo commit drafts. The composer lives in the companion, which unmounts whenever the
 * sheet closes or the tablet surface changes — without this, half a written message would be
 * lost to a glance at the diff. Kept in memory only: a stale draft outliving a cold start
 * would be attached to a tree that has since moved on.
 */
export const useCommitDraftStore = create<CommitDraftState>()((set) => ({
  messages: {},
  setMessage: (repoPath, message) => {
    set((state) => ({ messages: { ...state.messages, [repoPath]: message } }))
  },
  clearMessage: (repoPath) => {
    set((state) => {
      const { [repoPath]: _cleared, ...rest } = state.messages
      return { messages: rest }
    })
  },
}))
