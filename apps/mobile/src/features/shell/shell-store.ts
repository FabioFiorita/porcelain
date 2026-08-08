import { create } from 'zustand'

import type { SurfaceId } from './surfaces'

export type ShellSheet =
  | 'project'
  | 'search'
  | 'branch'
  | 'worktree'
  | 'settings'
  | 'companion'
  | null

/** Mirrors the desktop Settings dialog: General · Data · Review · Environments. */
export type SettingsSection = 'general' | 'data' | 'review' | 'environments'

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
