import { create } from 'zustand'

import { REPO_ROOT } from './file-paths'

type FilesState = {
  /**
   * Show entries the repo's scope hides. A monorepo's hidden list is what makes the tree
   * readable at all, so this is off by default and reads as a temporary override.
   */
  showHidden: boolean
  /** Tablet: the directory the list column is showing. Repo-relative; `''` is the repo root. */
  cursor: string
  /** Tablet: the file the viewer column holds. Repo-relative, or `null` for nothing open. */
  selection: string | null
  /** The 1-based line the viewer opened at (a search hit), or `null` for the top. */
  selectionLine: number | null
  toggleHidden: () => void
  openDir: (path: string) => void
  /** `line` is 1-based and only comes from a search hit. */
  openFile: (path: string, line?: number) => void
}

/**
 * Files view state — scope override and tablet navigation only. Search controls live in the
 * Search feature's unpersisted store so Files owns no Search workflow state.
 */
export const useFilesStore = create<FilesState>()((set) => ({
  cursor: REPO_ROOT,
  selection: null,
  selectionLine: null,
  showHidden: false,
  openDir: (cursor) => {
    set({ cursor })
  },
  openFile: (selection, line) => {
    set({ selection, selectionLine: line ?? null })
  },
  toggleHidden: () => {
    set((state) => ({ showHidden: !state.showHidden }))
  },
}))
