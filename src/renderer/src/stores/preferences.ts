import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ChangesScope = 'working' | 'branch'
export type DiffMode = 'unified' | 'split'
export type MarkdownMode = 'reader' | 'source'
export type PullMode = 'merge' | 'rebase'
export type SidebarTab =
  | 'files'
  | 'changes'
  | 'history'
  | 'feature'
  | 'board'
  | 'terminal'
  | 'search'

export const SIDEBAR_MIN_WIDTH = 320
export const RIGHT_SIDEBAR_MIN_WIDTH = 280
export const SIDEBAR_MAX_WIDTH = 520
export const NOTES_MIN_HEIGHT = 100
export const NOTES_MAX_HEIGHT = 600
export const SPLIT_MIN_RATIO = 0.2
export const SPLIT_MAX_RATIO = 0.8

interface PreferencesState {
  changesScope: ChangesScope
  diffMode: DiffMode
  markdownMode: MarkdownMode
  /** Strategy the `git pull` quick command uses (`--no-rebase` vs `--rebase`). */
  pullMode: PullMode
  rightSidebarOpen: boolean
  rightSidebarWidth: number
  sidebarTab: SidebarTab
  sidebarWidth: number
  notesHeight: number
  /** Fraction of the viewer width given to the left pane when split (0.2–0.8). */
  splitRatio: number
  /** Whether the user has installed the Claude Code plugin (demotes the CTA). */
  pluginInstalled: boolean
  /** Plugin version recorded at the last install; null if never recorded (pre-versioning
   * installs). When it differs from the app's bundled PLUGIN_VERSION, the Settings CTA
   * becomes "Update". */
  pluginVersion: string | null
  setChangesScope: (scope: ChangesScope) => void
  setDiffMode: (mode: DiffMode) => void
  setMarkdownMode: (mode: MarkdownMode) => void
  setPullMode: (mode: PullMode) => void
  setSidebarTab: (tab: SidebarTab) => void
  setRightSidebarOpen: (open: boolean) => void
  setRightSidebarWidth: (width: number) => void
  setSidebarWidth: (width: number) => void
  setNotesHeight: (height: number) => void
  setSplitRatio: (ratio: number) => void
  setPluginInstalled: (installed: boolean) => void
  setPluginVersion: (version: string | null) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      changesScope: 'working',
      diffMode: 'unified',
      markdownMode: 'reader',
      pullMode: 'merge',
      rightSidebarOpen: true,
      rightSidebarWidth: 272,
      sidebarTab: 'files',
      sidebarWidth: 256,
      notesHeight: 220,
      splitRatio: 0.5,
      pluginInstalled: false,
      pluginVersion: null,
      setChangesScope: (changesScope) => set({ changesScope }),
      setDiffMode: (diffMode) => set({ diffMode }),
      setMarkdownMode: (markdownMode) => set({ markdownMode }),
      setPullMode: (pullMode) => set({ pullMode }),
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      setRightSidebarOpen: (rightSidebarOpen) => set({ rightSidebarOpen }),
      setRightSidebarWidth: (width) =>
        set({
          rightSidebarWidth: Math.min(SIDEBAR_MAX_WIDTH, Math.max(RIGHT_SIDEBAR_MIN_WIDTH, width)),
        }),
      setSidebarWidth: (width) =>
        set({ sidebarWidth: Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)) }),
      setNotesHeight: (height) =>
        set({ notesHeight: Math.min(NOTES_MAX_HEIGHT, Math.max(NOTES_MIN_HEIGHT, height)) }),
      setSplitRatio: (ratio) =>
        set({ splitRatio: Math.min(SPLIT_MAX_RATIO, Math.max(SPLIT_MIN_RATIO, ratio)) }),
      setPluginInstalled: (pluginInstalled) => set({ pluginInstalled }),
      setPluginVersion: (pluginVersion) => set({ pluginVersion }),
    }),
    {
      name: 'porcelain-preferences',
      // Re-clamp persisted widths in case the min/max floor changed since they
      // were stored — otherwise an old too-narrow width would survive on load.
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.setSidebarWidth(state.sidebarWidth)
        state.setRightSidebarWidth(state.rightSidebarWidth)
      },
    },
  ),
)
