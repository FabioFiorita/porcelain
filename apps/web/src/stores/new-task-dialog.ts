import { create } from 'zustand'

/**
 * Compose intent for the new-task dialog — the same pattern as the project picker.
 * The left-rail plus, the ⌘⇧N chord, and the dialog itself share this store.
 */
interface NewTaskDialogState {
  open: boolean
  show: () => void
  hide: () => void
}

export const useNewTaskDialogStore = create<NewTaskDialogState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
