import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ChangesScope = 'working' | 'branch'
/** Appearance preference. `system` follows the OS `prefers-color-scheme`. */
export type ThemeMode = 'system' | 'light' | 'dark'
export type DiffMode = 'unified' | 'split'
export type MarkdownMode = 'reader' | 'source'
export type HtmlMode = 'preview' | 'source'
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
  /** Light/dark/system appearance. Applied pre-paint in main.tsx via lib/theme. */
  theme: ThemeMode
  changesScope: ChangesScope
  diffMode: DiffMode
  markdownMode: MarkdownMode
  /** Default for .html/.htm: sandboxed preview vs source. */
  htmlMode: HtmlMode
  /** Strategy the `git pull` quick command uses (`--no-rebase` vs `--rebase`). */
  pullMode: PullMode
  rightSidebarOpen: boolean
  rightSidebarWidth: number
  sidebarTab: SidebarTab
  sidebarWidth: number
  notesHeight: number
  /** Fraction of the viewer width given to the left pane when split (0.2–0.8). */
  splitRatio: number
  /** Bundled skills version the user last dismissed the upgrade toast for. */
  skillsDismissedVersion: string | null
  setChangesScope: (scope: ChangesScope) => void
  setDiffMode: (mode: DiffMode) => void
  setMarkdownMode: (mode: MarkdownMode) => void
  setHtmlMode: (mode: HtmlMode) => void
  setPullMode: (mode: PullMode) => void
  setSidebarTab: (tab: SidebarTab) => void
  setRightSidebarOpen: (open: boolean) => void
  setRightSidebarWidth: (width: number) => void
  setSidebarWidth: (width: number) => void
  setNotesHeight: (height: number) => void
  setSplitRatio: (ratio: number) => void
  setSkillsDismissedVersion: (version: string | null) => void
  setTheme: (theme: ThemeMode) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      changesScope: 'working',
      diffMode: 'unified',
      markdownMode: 'reader',
      htmlMode: 'preview',
      pullMode: 'merge',
      rightSidebarOpen: true,
      rightSidebarWidth: RIGHT_SIDEBAR_MIN_WIDTH,
      sidebarTab: 'files',
      sidebarWidth: 256,
      notesHeight: 220,
      splitRatio: 0.5,
      skillsDismissedVersion: null,
      setChangesScope: (changesScope: ChangesScope) => set({ changesScope }),
      setDiffMode: (diffMode: DiffMode) => set({ diffMode }),
      setMarkdownMode: (markdownMode: MarkdownMode) => set({ markdownMode }),
      setHtmlMode: (htmlMode: HtmlMode) => set({ htmlMode }),
      setPullMode: (pullMode: PullMode) => set({ pullMode }),
      setSidebarTab: (sidebarTab: SidebarTab) => set({ sidebarTab }),
      setRightSidebarOpen: (rightSidebarOpen: boolean) => set({ rightSidebarOpen }),
      setRightSidebarWidth: (width: number) =>
        set({
          rightSidebarWidth: Math.min(SIDEBAR_MAX_WIDTH, Math.max(RIGHT_SIDEBAR_MIN_WIDTH, width)),
        }),
      setSidebarWidth: (width: number) =>
        set({ sidebarWidth: Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)) }),
      setNotesHeight: (height: number) =>
        set({ notesHeight: Math.min(NOTES_MAX_HEIGHT, Math.max(NOTES_MIN_HEIGHT, height)) }),
      setSplitRatio: (ratio: number) =>
        set({ splitRatio: Math.min(SPLIT_MAX_RATIO, Math.max(SPLIT_MIN_RATIO, ratio)) }),
      setSkillsDismissedVersion: (skillsDismissedVersion: string | null) =>
        set({ skillsDismissedVersion }),
      setTheme: (theme: ThemeMode) => set({ theme }),
    }),
    {
      name: 'porcelain-preferences',
    },
  ),
)
