import { create } from 'zustand'

/**
 * The Project picker's open/closed intent — the "compose intent" half of the file-prompt
 * pattern (a tiny store toggled from anywhere, one dialog mounted in AppShell reads it).
 * All the browsing state (current path, entries) lives inside ProjectPickerDialog; this
 * store only says whether it's showing. `openProjectPicker` calls `show`, so the welcome button,
 * the project switcher, and any shortcut all route through here.
 */
interface ProjectPickerState {
  open: boolean
  environmentId: string | null
  show: (environmentId?: string | null) => void
  hide: () => void
}

export const useProjectPickerStore = create<ProjectPickerState>((set) => ({
  open: false,
  environmentId: null,
  show: (environmentId = null) => set({ environmentId, open: true }),
  hide: () => set({ environmentId: null, open: false }),
}))
