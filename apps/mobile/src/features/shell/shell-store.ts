import { create } from 'zustand'

import type { SurfaceId } from './surfaces'

/**
 * The sheets the shell still owns. Project / branch / worktree went with the header switcher —
 * a checkout is chosen in the Hub list now, not from a sheet over whatever surface you happen
 * to be on.
 */
export type ShellSheet = 'search' | 'settings' | 'companion' | null

/** Mirrors the desktop Settings dialog: General · Personalization · Companion · Remotes. */
export type SettingsSection = 'general' | 'personalization' | 'companion' | 'remotes'

type ShellState = {
  /** Active product surface (tablet rail + phone face). Independent of URL faces. */
  activeSurface: SurfaceId
  inspectorVisible: boolean
  sheet: ShellSheet
  settingsSection: SettingsSection
  setActiveSurface: (surface: SurfaceId) => void
  toggleInspector: () => void
  setInspectorVisible: (visible: boolean) => void
  openSheet: (sheet: Exclude<ShellSheet, null>) => void
  closeSheet: () => void
  setSettingsSection: (section: SettingsSection) => void
}

export const useShellStore = create<ShellState>()((set) => ({
  activeSurface: 'files',
  inspectorVisible: true,
  sheet: null,
  settingsSection: 'general',
  setActiveSurface: (activeSurface) => {
    set({ activeSurface })
  },
  toggleInspector: () => {
    set((state) => ({ inspectorVisible: !state.inspectorVisible }))
  },
  setInspectorVisible: (visible) => {
    set({ inspectorVisible: visible })
  },
  openSheet: (sheet) => {
    set({ sheet })
  },
  closeSheet: () => {
    set({ sheet: null })
  },
  setSettingsSection: (settingsSection) => {
    set({ settingsSection })
  },
}))
