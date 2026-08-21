import { create } from 'zustand'

import type { SurfaceId } from './surfaces'

/** Mirrors the desktop Settings dialog: General · Personalization · Companion · Remotes. */
export type SettingsSection = 'general' | 'personalization' | 'companion' | 'remotes'

type ShellState = {
  /** Active product surface (tablet rail + phone face). Independent of URL faces. */
  activeSurface: SurfaceId
  /** Tablet navigation panel. Open by default — it is the window's navigation. */
  sidebarVisible: boolean
  inspectorVisible: boolean
  settingsSection: SettingsSection
  setActiveSurface: (surface: SurfaceId) => void
  toggleSidebar: () => void
  toggleInspector: () => void
  setInspectorVisible: (visible: boolean) => void
  setSettingsSection: (section: SettingsSection) => void
}

export const useShellStore = create<ShellState>()((set) => ({
  activeSurface: 'files',
  inspectorVisible: true,
  sidebarVisible: true,
  settingsSection: 'general',
  setActiveSurface: (activeSurface) => {
    set({ activeSurface })
  },
  toggleSidebar: () => {
    set((state) => ({ sidebarVisible: !state.sidebarVisible }))
  },
  toggleInspector: () => {
    set((state) => ({ inspectorVisible: !state.inspectorVisible }))
  },
  setInspectorVisible: (visible) => {
    set({ inspectorVisible: visible })
  },
  setSettingsSection: (settingsSection) => {
    set({ settingsSection })
  },
}))
