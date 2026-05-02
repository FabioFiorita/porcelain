import { create } from 'zustand'

export type DiffMode = 'unified' | 'split'

export const SIDEBAR_MIN_WIDTH = 180
export const SIDEBAR_MAX_WIDTH = 520

interface PreferencesState {
  diffMode: DiffMode
  terminalOpen: boolean
  sidebarWidth: number
  setDiffMode: (mode: DiffMode) => void
  toggleTerminal: () => void
  setSidebarWidth: (width: number) => void
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  diffMode: 'unified',
  terminalOpen: false,
  sidebarWidth: 256,
  setDiffMode: (diffMode) => set({ diffMode }),
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  setSidebarWidth: (width) =>
    set({ sidebarWidth: Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)) }),
}))
