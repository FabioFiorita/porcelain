import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type DiffMode = 'unified' | 'split'
export type MarkdownMode = 'reader' | 'source'
export type SidebarTab = 'files' | 'changes' | 'history'

export const SIDEBAR_MIN_WIDTH = 180
export const SIDEBAR_MAX_WIDTH = 520

interface PreferencesState {
  diffMode: DiffMode
  markdownMode: MarkdownMode
  rightSidebarOpen: boolean
  rightSidebarWidth: number
  sidebarTab: SidebarTab
  sidebarWidth: number
  setDiffMode: (mode: DiffMode) => void
  setMarkdownMode: (mode: MarkdownMode) => void
  setSidebarTab: (tab: SidebarTab) => void
  setRightSidebarOpen: (open: boolean) => void
  setRightSidebarWidth: (width: number) => void
  setSidebarWidth: (width: number) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      diffMode: 'unified',
      markdownMode: 'reader',
      rightSidebarOpen: true,
      rightSidebarWidth: 272,
      sidebarTab: 'files',
      sidebarWidth: 256,
      setDiffMode: (diffMode) => set({ diffMode }),
      setMarkdownMode: (markdownMode) => set({ markdownMode }),
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      setRightSidebarOpen: (rightSidebarOpen) => set({ rightSidebarOpen }),
      setRightSidebarWidth: (width) =>
        set({ rightSidebarWidth: Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)) }),
      setSidebarWidth: (width) =>
        set({ sidebarWidth: Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)) }),
    }),
    { name: 'porcelain-preferences' },
  ),
)
