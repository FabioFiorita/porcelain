import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ChangesScope = 'working' | 'branch'
/** Appearance preference. `system` follows the OS `prefers-color-scheme`. */
export type ThemeMode = 'system' | 'light' | 'dark'
export type DiffMode = 'unified' | 'split'
export type MarkdownMode = 'reader' | 'source'
export type HtmlMode = 'preview' | 'source'
export type PullMode = 'merge' | 'rebase'
/**
 * How the embedded terminal paints cells (xterm.js renderer).
 * Canvas was removed upstream in xterm v6 — only WebGL and DOM remain.
 */
export type TerminalRenderer = 'webgl' | 'dom'
export type SidebarTab =
  | 'files'
  | 'changes'
  | 'history'
  | 'feature'
  | 'board'
  | 'chat'
  | 'terminal'
  | 'search'
  | 'agent'

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
  /**
   * Embedded terminal paint path. Default `webgl` for crisp block glyphs; switch
   * to `dom` if text ever garbles (WebGL atlas corruption). Applied live.
   */
  terminalRenderer: TerminalRenderer
  rightSidebarOpen: boolean
  rightSidebarWidth: number
  sidebarTab: SidebarTab
  sidebarWidth: number
  notesHeight: number
  /** Fraction of the viewer width given to the left pane when split (0.2–0.8). */
  splitRatio: number
  /** Bundled skills version the user last dismissed the upgrade toast for. */
  skillsDismissedVersion: string | null
  /**
   * Agent thread ids the human archived (client-only, per device). Threads stay
   * on the daemon; archive only hides them from Active/Recent until restored.
   */
  archivedAgentThreadIds: string[]
  setChangesScope: (scope: ChangesScope) => void
  setDiffMode: (mode: DiffMode) => void
  setMarkdownMode: (mode: MarkdownMode) => void
  setHtmlMode: (mode: HtmlMode) => void
  setPullMode: (mode: PullMode) => void
  setTerminalRenderer: (renderer: TerminalRenderer) => void
  setSidebarTab: (tab: SidebarTab) => void
  setRightSidebarOpen: (open: boolean) => void
  setRightSidebarWidth: (width: number) => void
  setSidebarWidth: (width: number) => void
  setNotesHeight: (height: number) => void
  setSplitRatio: (ratio: number) => void
  setSkillsDismissedVersion: (version: string | null) => void
  setTheme: (theme: ThemeMode) => void
  archiveAgentThread: (id: string) => void
  unarchiveAgentThread: (id: string) => void
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
      terminalRenderer: 'webgl',
      rightSidebarOpen: true,
      rightSidebarWidth: 272,
      sidebarTab: 'files',
      sidebarWidth: 256,
      notesHeight: 220,
      splitRatio: 0.5,
      skillsDismissedVersion: null,
      archivedAgentThreadIds: [],
      setChangesScope: (changesScope) => set({ changesScope }),
      setDiffMode: (diffMode) => set({ diffMode }),
      setMarkdownMode: (markdownMode) => set({ markdownMode }),
      setHtmlMode: (htmlMode) => set({ htmlMode }),
      setPullMode: (pullMode) => set({ pullMode }),
      setTerminalRenderer: (terminalRenderer) => set({ terminalRenderer }),
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
      setSkillsDismissedVersion: (skillsDismissedVersion) => set({ skillsDismissedVersion }),
      setTheme: (theme) => set({ theme }),
      archiveAgentThread: (id) =>
        set((s) =>
          s.archivedAgentThreadIds.includes(id)
            ? s
            : { archivedAgentThreadIds: [...s.archivedAgentThreadIds, id] },
        ),
      unarchiveAgentThread: (id) =>
        set((s) => ({
          archivedAgentThreadIds: s.archivedAgentThreadIds.filter((x) => x !== id),
        })),
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
