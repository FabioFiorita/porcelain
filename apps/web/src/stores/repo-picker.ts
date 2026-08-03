import { create } from 'zustand'

/**
 * The repo picker's open/closed intent — the "compose intent" half of the file-prompt
 * pattern (a tiny store toggled from anywhere, one dialog mounted in AppShell reads it).
 * All the browsing state (current path, entries) lives inside RepoPickerDialog; this
 * store only says whether it's showing. `openRepo` (stores/repo.ts) calls `show`, so the
 * welcome button, the project switcher, and any shortcut all route through here.
 */
interface RepoPickerState {
  open: boolean
  show: () => void
  hide: () => void
}

export const useRepoPickerStore = create<RepoPickerState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
