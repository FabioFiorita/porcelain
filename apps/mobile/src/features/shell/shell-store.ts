import { create } from 'zustand'

import { defaultSelectedIds, type SurfaceId } from './mock-data'

export type ShellSheet = 'project' | 'search' | 'branch' | 'worktree' | 'settings' | null

export type SettingsSection = 'general' | 'review' | 'environments'

type ShellState = {
  /** Tablet surface selection (independent of phone tab routes). */
  activeSurface: SurfaceId
  inspectorVisible: boolean
  sheet: ShellSheet
  settingsSection: SettingsSection
  selectedIds: Record<SurfaceId, string>
  setActiveSurface: (surface: SurfaceId) => void
  toggleInspector: () => void
  setInspectorVisible: (visible: boolean) => void
  openSheet: (sheet: Exclude<ShellSheet, null>) => void
  closeSheet: () => void
  setSettingsSection: (section: SettingsSection) => void
  selectItem: (surface: SurfaceId, id: string) => void
}

export const useShellStore = create<ShellState>()((set) => ({
  activeSurface: 'files',
  inspectorVisible: true,
  sheet: null,
  settingsSection: 'general',
  selectedIds: defaultSelectedIds(),
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
  selectItem: (surface, id) => {
    set((state) => ({
      selectedIds: { ...state.selectedIds, [surface]: id },
    }))
  },
}))
