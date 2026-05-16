import { create } from 'zustand'

export type TabKind = 'file' | 'diff' | 'commit' | 'search'

export interface Tab {
  id: string
  kind: TabKind
  title: string
  /** File path for file/diff tabs, commit hash for commit tabs, query for search tabs. */
  path: string
  /** 1-based line to scroll to when opening (search results jump here). */
  line?: number
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string | null
  openTab: (tab: Tab) => void
  closeTab: (id: string) => void
  closeOtherTabs: (id: string) => void
  closeTabsToLeft: (id: string) => void
  closeTabsToRight: (id: string) => void
  closeAllTabs: () => void
  activateTab: (id: string) => void
  cycleTab: (direction: 1 | -1) => void
}

// Closing a set of tabs keeps the anchor tab and activates it if the active
// tab was among the closed ones.
const closeTabsWhere =
  (keep: (index: number, anchorIndex: number) => boolean) =>
  (state: TabsState, id: string): Partial<TabsState> => {
    const anchorIndex = state.tabs.findIndex((t) => t.id === id)
    if (anchorIndex === -1) return state
    const tabs = state.tabs.filter((_, index) => keep(index, anchorIndex))
    const activeTabId = tabs.some((t) => t.id === state.activeTabId) ? state.activeTabId : id
    return { tabs, activeTabId }
  }

const keepOnlyAnchor = closeTabsWhere((index, anchor) => index === anchor)
const keepFromAnchor = closeTabsWhere((index, anchor) => index >= anchor)
const keepThroughAnchor = closeTabsWhere((index, anchor) => index <= anchor)

export const useTabsStore = create<TabsState>((set) => ({
  tabs: [],
  activeTabId: null,
  openTab: (tab) =>
    set((state) => {
      const existing = state.tabs.find((t) => t.id === tab.id)
      const tabs = existing
        ? // re-opening can carry a new target line (e.g. another search result)
          state.tabs.map((t) => (t.id === tab.id ? { ...t, line: tab.line ?? t.line } : t))
        : [...state.tabs, tab]
      return { tabs, activeTabId: tab.id }
    }),
  closeTab: (id) =>
    set((state) => {
      const index = state.tabs.findIndex((t) => t.id === id)
      const tabs = state.tabs.filter((t) => t.id !== id)
      const activeTabId =
        state.activeTabId === id
          ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null)
          : state.activeTabId
      return { tabs, activeTabId }
    }),
  closeOtherTabs: (id) => set((state) => keepOnlyAnchor(state, id)),
  closeTabsToLeft: (id) => set((state) => keepFromAnchor(state, id)),
  closeTabsToRight: (id) => set((state) => keepThroughAnchor(state, id)),
  closeAllTabs: () => set({ tabs: [], activeTabId: null }),
  activateTab: (id) => set({ activeTabId: id }),
  cycleTab: (direction) =>
    set((state) => {
      if (state.tabs.length < 2) return state
      const index = state.tabs.findIndex((t) => t.id === state.activeTabId)
      const next = (index + direction + state.tabs.length) % state.tabs.length
      return { activeTabId: state.tabs[next]?.id ?? state.activeTabId }
    }),
}))
