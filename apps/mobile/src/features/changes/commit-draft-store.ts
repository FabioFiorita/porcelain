import { create } from 'zustand'

type CommitDraftState = {
  /** Message drafts keyed by repo path. */
  messages: Record<string, string>
  setMessage: (repoPath: string, message: string) => void
  clearMessage: (repoPath: string) => void
}

/**
 * Per-repo commit drafts. The composer lives on the Git surface, which unmounts as soon as you
 * navigate off it — without this, half a written message would be lost to a glance at the diff.
 * It stays in this feature because the draft belongs to the repository rather than to whichever
 * screen is composing: one message per repo path, whoever is reading or writing it. Kept in
 * memory only: a stale draft outliving a cold start would be attached to a tree that has since
 * moved on.
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
