import { create } from 'zustand'

export type TabKind = 'file' | 'diff' | 'commit'

export interface Tab {
  id: string
  kind: TabKind
  title: string
  path: string
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string | null
  openTab: (tab: Tab) => void
  closeTab: (id: string) => void
  activateTab: (id: string) => void
}

export const useTabsStore = create<TabsState>((set) => ({
  tabs: [],
  activeTabId: null,
  openTab: (tab) =>
    set((state) => {
      const existing = state.tabs.find((t) => t.id === tab.id)
      return {
        tabs: existing ? state.tabs : [...state.tabs, tab],
        activeTabId: tab.id,
      }
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
  activateTab: (id) => set({ activeTabId: id }),
}))
