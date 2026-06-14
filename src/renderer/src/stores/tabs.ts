import { create } from 'zustand'

export type TabKind = 'file' | 'diff' | 'commit' | 'search' | 'feature'

// The tabs store is the router: a tab id is its kind plus its key (file path,
// commit hash, or search query). Every opener must build ids through this so
// the same target always maps to the same tab.
export function tabId(kind: TabKind, key: string): string {
  return `${kind}:${key}`
}

export interface Tab {
  id: string
  kind: TabKind
  title: string
  /** File path for file/diff tabs, commit hash for commit tabs, query for search tabs. */
  path: string
  /** 1-based line to scroll to when opening (search results jump here). */
  line?: number
  /** Preview tabs (single-click) are replaced by the next preview; double-click pins. */
  preview?: boolean
}

// A pane is one column of the (optionally split) viewer: its own ordered tab
// list and active tab. The unsplit viewer is a single pane; "Open to the Side"
// creates a second one and the split collapses back when a pane empties.
export interface Pane {
  tabs: Tab[]
  activeTabId: string | null
}

interface TabsState {
  panes: Pane[]
  /** Pane that receives new opens and owns focus (0 or 1). */
  activePaneIndex: number
  openTab: (tab: Tab) => void
  openTabToSide: (tab: Tab) => void
  pinTab: (id: string) => void
  closeTab: (paneIndex: number, id: string) => void
  closeOtherTabs: (paneIndex: number, id: string) => void
  closeTabsToLeft: (paneIndex: number, id: string) => void
  closeTabsToRight: (paneIndex: number, id: string) => void
  closeAllTabs: () => void
  activateTab: (paneIndex: number, id: string) => void
  setActivePane: (paneIndex: number) => void
  cycleTab: (direction: 1 | -1) => void
}

const emptyPane = (): Pane => ({ tabs: [], activeTabId: null })

// Insert (or re-target) a tab in one pane — the preview/dedup rules, scoped to
// a single pane so each side keeps its own preview slot.
function addTab(pane: Pane, tab: Tab): Pane {
  const existing = pane.tabs.find((t) => t.id === tab.id)
  if (existing) {
    // re-opening can carry a new target line; a non-preview re-open pins
    const tabs = pane.tabs.map((t) =>
      t.id === tab.id
        ? { ...t, line: tab.line ?? t.line, preview: t.preview === true && tab.preview === true }
        : t,
    )
    return { tabs, activeTabId: tab.id }
  }
  if (tab.preview) {
    const previewIndex = pane.tabs.findIndex((t) => t.preview)
    if (previewIndex !== -1) {
      const tabs = pane.tabs.map((t, index) => (index === previewIndex ? tab : t))
      return { tabs, activeTabId: tab.id }
    }
  }
  return { tabs: [...pane.tabs, tab], activeTabId: tab.id }
}

// Remove one tab from a pane, activating its neighbor if the active tab closed.
function removeTab(pane: Pane, id: string): Pane {
  const index = pane.tabs.findIndex((t) => t.id === id)
  if (index === -1) return pane
  const tabs = pane.tabs.filter((t) => t.id !== id)
  const activeTabId =
    pane.activeTabId === id
      ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null)
      : pane.activeTabId
  return { tabs, activeTabId }
}

// Bulk close within a pane: keep the anchor and activate it if the active tab
// was among the closed ones.
const keepWhere =
  (keep: (index: number, anchorIndex: number) => boolean) =>
  (pane: Pane, id: string): Pane => {
    const anchorIndex = pane.tabs.findIndex((t) => t.id === id)
    if (anchorIndex === -1) return pane
    const tabs = pane.tabs.filter((_, index) => keep(index, anchorIndex))
    const activeTabId = tabs.some((t) => t.id === pane.activeTabId) ? pane.activeTabId : id
    return { tabs, activeTabId }
  }

const keepOnlyAnchor = keepWhere((index, anchor) => index === anchor)
const keepFromAnchor = keepWhere((index, anchor) => index >= anchor)
const keepThroughAnchor = keepWhere((index, anchor) => index <= anchor)

// After a close, an emptied second pane collapses the split: drop empty panes,
// keep at least one (an empty single pane shows the welcome view).
function normalize(
  panes: Pane[],
  activePaneIndex: number,
): Pick<TabsState, 'panes' | 'activePaneIndex'> {
  if (panes.length <= 1) return { panes, activePaneIndex: 0 }
  const kept = panes.filter((p) => p.tabs.length > 0)
  if (kept.length === panes.length) return { panes, activePaneIndex }
  const survivors = kept.length > 0 ? kept : [emptyPane()]
  return { panes: survivors, activePaneIndex: Math.min(activePaneIndex, survivors.length - 1) }
}

// Apply a pane-level edit to one pane and re-normalize the split.
const editPane =
  (index: number, fn: (pane: Pane) => Pane) =>
  (state: TabsState): Partial<TabsState> => {
    const pane = state.panes[index]
    if (!pane) return state
    const panes = state.panes.map((p, i) => (i === index ? fn(p) : p))
    return normalize(panes, state.activePaneIndex)
  }

export const useTabsStore = create<TabsState>((set) => ({
  panes: [emptyPane()],
  activePaneIndex: 0,
  openTab: (tab) =>
    set((state) => ({
      panes: state.panes.map((p, i) => (i === state.activePaneIndex ? addTab(p, tab) : p)),
    })),
  openTabToSide: (tab) =>
    set((state) => {
      if (state.panes.length === 1) {
        return { panes: [state.panes[0], addTab(emptyPane(), tab)], activePaneIndex: 1 }
      }
      const target = state.activePaneIndex === 0 ? 1 : 0
      return {
        panes: state.panes.map((p, i) => (i === target ? addTab(p, tab) : p)),
        activePaneIndex: target,
      }
    }),
  pinTab: (id) =>
    set((state) => ({
      // a file can sit in both panes; pin every copy so edit-mode pinning is consistent
      panes: state.panes.map((p) =>
        p.tabs.some((t) => t.id === id && t.preview)
          ? { ...p, tabs: p.tabs.map((t) => (t.id === id ? { ...t, preview: false } : t)) }
          : p,
      ),
    })),
  closeTab: (paneIndex, id) => set(editPane(paneIndex, (p) => removeTab(p, id))),
  closeOtherTabs: (paneIndex, id) => set(editPane(paneIndex, (p) => keepOnlyAnchor(p, id))),
  closeTabsToLeft: (paneIndex, id) => set(editPane(paneIndex, (p) => keepFromAnchor(p, id))),
  closeTabsToRight: (paneIndex, id) => set(editPane(paneIndex, (p) => keepThroughAnchor(p, id))),
  closeAllTabs: () => set({ panes: [emptyPane()], activePaneIndex: 0 }),
  activateTab: (paneIndex, id) =>
    set((state) => ({
      panes: state.panes.map((p, i) => (i === paneIndex ? { ...p, activeTabId: id } : p)),
      activePaneIndex: paneIndex,
    })),
  setActivePane: (paneIndex) =>
    set((state) => (state.panes[paneIndex] ? { activePaneIndex: paneIndex } : state)),
  cycleTab: (direction) =>
    set((state) => {
      const pane = state.panes[state.activePaneIndex]
      if (!pane || pane.tabs.length < 2) return state
      const index = pane.tabs.findIndex((t) => t.id === pane.activeTabId)
      const next = (index + direction + pane.tabs.length) % pane.tabs.length
      return {
        panes: state.panes.map((p, i) =>
          i === state.activePaneIndex
            ? { ...p, activeTabId: pane.tabs[next]?.id ?? p.activeTabId }
            : p,
        ),
      }
    }),
}))
