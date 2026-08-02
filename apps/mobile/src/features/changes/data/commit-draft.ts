import { create } from 'zustand'

type CommitDraftState = {
  readonly messages: Record<string, string>
  readonly clearMessage: (repoPath: string) => void
  readonly setMessage: (repoPath: string, message: string) => void
}

export const useCommitDraftStore = create<CommitDraftState>((set) => ({
  clearMessage: (repoPath: string): void =>
    set((state) => {
      if (!(repoPath in state.messages)) return state
      const { [repoPath]: _removed, ...messages } = state.messages
      return { messages }
    }),
  messages: {},
  setMessage: (repoPath: string, message: string): void =>
    set((state) => ({ messages: { ...state.messages, [repoPath]: message } })),
}))
