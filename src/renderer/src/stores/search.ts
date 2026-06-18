import { create } from 'zustand'

const MAX_RECENT = 8

/**
 * The Search tab's query + filter state, plus a recent-queries roster. Lives in a
 * store (not component state) so the panel and the Quick Access recents share it;
 * client-only and not persisted — a search session is ephemeral, like terminals.
 */
interface SearchState {
  query: string
  regex: boolean
  caseSensitive: boolean
  /** Whether the include/exclude glob fields are revealed. */
  showFilters: boolean
  include: string
  exclude: string
  recent: string[]
  setQuery: (query: string) => void
  toggleRegex: () => void
  toggleCaseSensitive: () => void
  toggleFilters: () => void
  setInclude: (include: string) => void
  setExclude: (exclude: string) => void
  /** Record a settled query at the top of the recents (deduped, capped). */
  remember: (query: string) => void
  /** Drop a single query from the recents. */
  forget: (query: string) => void
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  regex: false,
  caseSensitive: false,
  showFilters: false,
  include: '',
  exclude: '',
  recent: [],
  setQuery: (query) => set({ query }),
  toggleRegex: () => set((s) => ({ regex: !s.regex })),
  toggleCaseSensitive: () => set((s) => ({ caseSensitive: !s.caseSensitive })),
  toggleFilters: () => set((s) => ({ showFilters: !s.showFilters })),
  setInclude: (include) => set({ include }),
  setExclude: (exclude) => set({ exclude }),
  remember: (query) =>
    set((s) => {
      const trimmed = query.trim()
      if (trimmed === '') return s
      return { recent: [trimmed, ...s.recent.filter((q) => q !== trimmed)].slice(0, MAX_RECENT) }
    }),
  forget: (query) => set((s) => ({ recent: s.recent.filter((q) => q !== query) })),
}))
