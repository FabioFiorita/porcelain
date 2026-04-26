import { create } from 'zustand'

interface TerminalState {
  /** Active terminal session id, keyed in the main process. */
  termId: string | null
  setTermId: (id: string | null) => void
}

export const useTerminalStore = create<TerminalState>((set) => ({
  termId: null,
  setTermId: (termId) => set({ termId }),
}))
