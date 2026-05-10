import { trpcClient } from '@renderer/lib/trpc'
import { create } from 'zustand'

interface TerminalState {
  /** Active terminal session id, keyed in the main process. */
  termId: string | null
  /** Text queued for a session that is still being created; flushed on attach. */
  pendingInput: string | null
  setTermId: (id: string | null) => void
  takePendingInput: () => string | null
  /** Type text into the terminal (no newline — the user confirms with Enter). */
  insertInput: (text: string) => Promise<void>
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  termId: null,
  pendingInput: null,
  setTermId: (termId) => set({ termId }),
  takePendingInput: () => {
    const pending = get().pendingInput
    if (pending !== null) set({ pendingInput: null })
    return pending
  },
  insertInput: async (text) => {
    const { termId } = get()
    if (termId && (await trpcClient.termExists.query(termId))) {
      await trpcClient.termWrite.mutate({ id: termId, data: text })
      return
    }
    set({ pendingInput: text })
  },
}))
