import { create } from 'zustand'

export type DiffMode = 'unified' | 'split'

interface PreferencesState {
  diffMode: DiffMode
  terminalOpen: boolean
  setDiffMode: (mode: DiffMode) => void
  toggleTerminal: () => void
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  diffMode: 'unified',
  terminalOpen: false,
  setDiffMode: (diffMode) => set({ diffMode }),
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
}))
