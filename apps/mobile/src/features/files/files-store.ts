import { create } from 'zustand'

import { REPO_ROOT } from './file-paths'

/**
 * Which question the Search face is asking. `text` searches the repo's contents (the desktop's
 * Search tab); `files` fuzzy-matches paths (the desktop's ⌘P finder). Two searches, one field,
 * because a phone has no room for two.
 */
export type SearchMode = 'text' | 'files'

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
  /** Tablet: the 1-based line the viewer opened at (a search hit), or `null` for the top. */
  selectionLine: number | null
  /** The Search face's query, shared so the tablet's results and viewer agree on it. */
  query: string
  /** Contents or filenames. */
  searchMode: SearchMode
  /** Content search: match the query's case. */
  caseSensitive: boolean
  /** Content search: read the query as an extended regular expression. */
  regex: boolean
  /** Content search: whether the glob fields are on screen. */
  showFilters: boolean
  /** Content search: comma-separated git pathspec globs to search / to skip. */
  include: string
  exclude: string
  /** Queries that found something, newest first — the Search companion's roster. */
  recentSearches: string[]
  toggleHidden: () => void
  openDir: (path: string) => void
  /** `line` is 1-based and only comes from a search hit. */
  openFile: (path: string, line?: number) => void
  setQuery: (query: string) => void
  setSearchMode: (mode: SearchMode) => void
  toggleCaseSensitive: () => void
  toggleRegex: () => void
  toggleFilters: () => void
  setInclude: (include: string) => void
  setExclude: (exclude: string) => void
  /** Record a settled query at the top of the recents (trimmed, deduped, capped). */
  rememberSearch: (query: string) => void
  /** Drop a single query from the recents. */
  forgetSearch: (query: string) => void
}

/** Enough to get back to this morning's searches without becoming a list you scroll. */
const MAX_RECENT_SEARCHES = 8

/**
 * Files view state — the scope override, the Search face's controls, and on tablet what the two
 * columns hold.
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
  caseSensitive: false,
  cursor: REPO_ROOT,
  exclude: '',
  include: '',
  query: '',
  recentSearches: [],
  regex: false,
  searchMode: 'text',
  selection: null,
  selectionLine: null,
  showFilters: false,
  showHidden: false,
  forgetSearch: (query) => {
    set((state) => ({ recentSearches: state.recentSearches.filter((q) => q !== query) }))
  },
  openDir: (cursor) => {
    set({ cursor })
  },
  openFile: (selection, line) => {
    set({ selection, selectionLine: line ?? null })
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
  setExclude: (exclude) => {
    set({ exclude })
  },
  setInclude: (include) => {
    set({ include })
  },
  setQuery: (query) => {
    set({ query })
  },
  setSearchMode: (searchMode) => {
    set({ searchMode })
  },
  toggleCaseSensitive: () => {
    set((state) => ({ caseSensitive: !state.caseSensitive }))
  },
  toggleFilters: () => {
    set((state) => ({ showFilters: !state.showFilters }))
  },
  toggleHidden: () => {
    set((state) => ({ showHidden: !state.showHidden }))
  },
  toggleRegex: () => {
    set((state) => ({ regex: !state.regex }))
  },
}))
