import { create } from 'zustand'

/**
 * Open/closed state for the Cmd+P file finder, lifted out of the component so the
 * titlebar search bar (which lives above the sidebar providers, outside the
 * finder's subtree) can open the same popup. The finder still owns its query and
 * the Cmd+P/Cmd+K window listeners; this store is only the visibility latch.
 */
interface FileFinderState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useFileFinderStore = create<FileFinderState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
