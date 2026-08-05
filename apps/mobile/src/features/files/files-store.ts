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
  /** The Search face's query, shared so the tablet's results and viewer agree on it. */
  query: string
  /** Queries that found something, newest first — the Search companion's roster. */
  recentSearches: string[]
  toggleHidden: () => void
  openDir: (path: string) => void
  openFile: (path: string) => void
  setQuery: (query: string) => void
  /** Record a settled query at the top of the recents (trimmed, deduped, capped). */
  rememberSearch: (query: string) => void
  /** Drop a single query from the recents. */
  forgetSearch: (query: string) => void
}

/** Enough to get back to this morning's searches without becoming a list you scroll. */
const MAX_RECENT_SEARCHES = 8

/**
 * Files view state — the scope override, and on tablet what the two columns hold.
 *
 * Navigation is the **tablet's** model only: its list and viewer are SplitView columns the
 * route does not own, so there is nothing to push. The phone reads both from the route
 * instead, which is what earns it the native pop gesture and the hardware back button. Same
 * trade the Changes tab made, for the same reason.
 *
 * Deliberately not persisted: a path from a previous cold start may not exist any more, and
 * restoring it would fire a daemon read before the environment has reconnected.
 */
export const useFilesStore = create<FilesState>()((set) => ({
  cursor: REPO_ROOT,
  query: '',
  recentSearches: [],
  selection: null,
  showHidden: false,
  forgetSearch: (query) => {
    set((state) => ({ recentSearches: state.recentSearches.filter((q) => q !== query) }))
  },
  openDir: (cursor) => {
    set({ cursor })
  },
  openFile: (selection) => {
    set({ selection })
  },
  rememberSearch: (query) => {
    const trimmed = query.trim()
    if (trimmed === '') return
    set((state) => ({
      recentSearches: [trimmed, ...state.recentSearches.filter((q) => q !== trimmed)].slice(
        0,
        MAX_RECENT_SEARCHES,
      ),
    }))
  },
  setQuery: (query) => {
    set({ query })
  },
  toggleHidden: () => {
    set((state) => ({ showHidden: !state.showHidden }))
  },
}))
