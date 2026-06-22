import { create } from 'zustand'

export type SettingsSection = 'general' | 'flow' | 'agents' | 'updates'

/**
 * Open/section state for the Settings dialog, lifted out of the component so other
 * surfaces (e.g. the plugin-update toast) can open it straight to a section. The
 * gear trigger in the sidebar footer still drives it through `setOpen`.
 */
interface SettingsDialogState {
  open: boolean
  section: SettingsSection
  /** Open the dialog, optionally jumping straight to a section. */
  openTo: (section?: SettingsSection) => void
  setOpen: (open: boolean) => void
  setSection: (section: SettingsSection) => void
}

export const useSettingsDialogStore = create<SettingsDialogState>((set) => ({
  open: false,
  section: 'general',
  openTo: (section) => set(section ? { open: true, section } : { open: true }),
  setOpen: (open) => set({ open }),
  setSection: (section) => set({ section }),
}))
