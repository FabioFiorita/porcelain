import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type DiffMode = 'unified' | 'split'
export type MarkdownMode = 'reader' | 'source'

export const SIDEBAR_MIN_WIDTH = 180
export const SIDEBAR_MAX_WIDTH = 520

interface PreferencesState {
  diffMode: DiffMode
  markdownMode: MarkdownMode
  terminalOpen: boolean
  sidebarWidth: number
  setDiffMode: (mode: DiffMode) => void
  setMarkdownMode: (mode: MarkdownMode) => void
  toggleTerminal: () => void
  setSidebarWidth: (width: number) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      diffMode: 'unified',
      markdownMode: 'reader',
      terminalOpen: false,
      sidebarWidth: 256,
      setDiffMode: (diffMode) => set({ diffMode }),
      setMarkdownMode: (markdownMode) => set({ markdownMode }),
      toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
      setSidebarWidth: (width) =>
        set({ sidebarWidth: Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)) }),
    }),
    { name: 'porcelain-preferences' },
  ),
)
