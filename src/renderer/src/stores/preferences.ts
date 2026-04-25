import { create } from 'zustand'

export type DiffMode = 'unified' | 'split'

interface PreferencesState {
  diffMode: DiffMode
  setDiffMode: (mode: DiffMode) => void
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  diffMode: 'unified',
  setDiffMode: (diffMode) => set({ diffMode }),
}))
