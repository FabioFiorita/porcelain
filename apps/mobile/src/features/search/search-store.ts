import { create } from 'zustand'

/** Which question the Search face is asking. */
export type SearchMode = 'text' | 'files'

type SearchState = {
  /** The Search face's query, shared by the panel and the companion. */
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

const MAX_RECENT_SEARCHES = 8

/** Search presentation workflow only; server results stay in TanStack Query. */
export const useSearchStore = create<SearchState>()((set) => ({
  caseSensitive: false,
  exclude: '',
  include: '',
  query: '',
  recentSearches: [],
  regex: false,
  searchMode: 'text',
  forgetSearch: (query) => {
    set((state) => ({ recentSearches: state.recentSearches.filter((q) => q !== query) }))
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
  toggleRegex: () => {
    set((state) => ({ regex: !state.regex }))
  },
  showFilters: false,
}))
