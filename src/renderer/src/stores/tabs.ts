import { create } from 'zustand'

export type TabKind =
  | 'file'
  | 'diff'
  | 'commit'
  | 'review'
  | 'search'
  | 'feature'
  | 'explore'
  | 'board'
  | 'terminal'
  | 'artifact'
  | 'evidence'
  | 'agent'

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
  /** File path for file/diff tabs, commit hash for commit tabs, query for search tabs,
   *  terminal session id for terminal tabs, thread id for agent tabs, repo path for
   *  artifact/evidence tabs, review scope key (`working` / `branch` / `commit:<hash>`)
   *  for review tabs. (Agent tabs use the generic clone/preview path — unlike a
   *  terminal's single xterm DOM node, an agent view's state lives in the store, so it
   *  can render in both panes at once and needs no special-casing in `openTab`/
   *  `openTabToSide`.) */
  path: string
  /** 1-based line to scroll to when opening (search results jump here). */
  line?: number
  /** Explore tabs only: the seed symbol (omitted ⇒ a whole-file seed). */
  symbol?: string
  /** Diff tabs only: the range base ref. Omitted ⇒ a working-tree diff. */
  base?: string
  /** Preview tabs (single-click) are replaced by the next preview; double-click pins
   *  (clears this flag via `pinTab`). Distinct from sticky `pinned` below. */
  preview?: boolean
  /** Sticky-pinned to the left of the tab bar — stays fixed while unpinned tabs scroll.
   *  Independent of `preview` (a sticky pin also clears preview so it can't be replaced). */
  pinned?: boolean
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
  /** Clear the preview flag (single-click → kept). Not the sticky tab-bar pin. */
  pinTab: (id: string) => void
  /** Toggle sticky pin for a tab in one pane (pinned strip stays fixed; unpinned scroll). */
  togglePinned: (paneIndex: number, id: string) => void
  closeTab: (paneIndex: number, id: string) => void
  closeOtherTabs: (paneIndex: number, id: string) => void
  closeTabsToLeft: (paneIndex: number, id: string) => void
  closeTabsToRight: (paneIndex: number, id: string) => void
  /** Close every unpinned tab in the pane; sticky-pinned tabs stay. */
  closeUnpinnedTabs: (paneIndex: number) => void
  /** Close a tab in whichever pane(s) hold it — for when its underlying source
   *  is gone (a terminal session killed, a file's diff discarded) and an orphaned
   *  tab would show a dead view. Pane-agnostic by design (the caller has the id,
   *  not the pane), unlike the pane-scoped `closeTab`. */
  closeTabEverywhere: (id: string) => void
  /** Retitle every open terminal tab for a session (its `path` holds the session id)
   *  across both panes — kept in sync when the session is renamed in the roster. */
  retitleTerminalTab: (sessionId: string, title: string) => void
  /** Retitle every open agent tab for a thread (its `path` holds the thread id) across
   *  both panes — kept in sync when the thread's auto-title lands or it's renamed. */
  retitleAgentTab: (threadId: string, title: string) => void
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

// Sticky pin: reorder so all pinned tabs sit first (order among each group preserved),
// then the target tab is placed at the end of the pinned group (pin) or the front of
// the unpinned group (unpin). Pinning also clears `preview` so a sticky tab can't be
// replaced by the next single-click open.
function setPinned(pane: Pane, id: string, pinned: boolean): Pane {
  const index = pane.tabs.findIndex((t) => t.id === id)
  if (index === -1) return pane
  const current = pane.tabs[index]
  if (!current || !!current.pinned === pinned) return pane
  const updated: Tab = pinned
    ? { ...current, pinned: true, preview: false }
    : { ...current, pinned: false }
  const rest = pane.tabs.filter((t) => t.id !== id)
  const pinnedTabs = rest.filter((t) => t.pinned)
  const unpinnedTabs = rest.filter((t) => !t.pinned)
  // Pin → end of pinned group; unpin → front of unpinned group (same splice).
  return { ...pane, tabs: [...pinnedTabs, updated, ...unpinnedTabs] }
}

function dropUnpinned(pane: Pane): Pane {
  const tabs = pane.tabs.filter((t) => t.pinned)
  if (tabs.length === pane.tabs.length) return pane
  const activeTabId = tabs.some((t) => t.id === pane.activeTabId)
    ? pane.activeTabId
    : (tabs[tabs.length - 1]?.id ?? null)
  return { tabs, activeTabId }
}

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
    set((state) => {
      // A terminal is a single xterm instance — it can't be cloned into a second pane.
      // If it's already open somewhere, activate it in place instead of duplicating it.
      if (tab.kind === 'terminal') {
        const existing = state.panes.findIndex((p) => p.tabs.some((t) => t.id === tab.id))
        if (existing !== -1) {
          return {
            panes: state.panes.map((p, i) => (i === existing ? { ...p, activeTabId: tab.id } : p)),
            activePaneIndex: existing,
          }
        }
      }
      return {
        panes: state.panes.map((p, i) => (i === state.activePaneIndex ? addTab(p, tab) : p)),
      }
    }),
  openTabToSide: (tab) =>
    set((state) => {
      // Terminals MOVE to the other pane (one xterm can't render in two places); a
      // generic tab is cloned. Stripping the terminal from its source pane first is
      // what makes the split show two distinct shells instead of one blanking out.
      if (tab.kind === 'terminal') {
        const stripped = state.panes.map((p) =>
          p.tabs.some((t) => t.id === tab.id) ? removeTab(p, tab.id) : p,
        )
        if (stripped.length === 1) {
          return normalize([stripped[0], addTab(emptyPane(), tab)], 1)
        }
        const target = state.activePaneIndex === 0 ? 1 : 0
        return normalize(
          stripped.map((p, i) => (i === target ? addTab(p, tab) : p)),
          target,
        )
      }
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
  togglePinned: (paneIndex, id) =>
    set(
      editPane(paneIndex, (p) => {
        const tab = p.tabs.find((t) => t.id === id)
        if (!tab) return p
        return setPinned(p, id, !tab.pinned)
      }),
    ),
  closeTab: (paneIndex, id) => set(editPane(paneIndex, (p) => removeTab(p, id))),
  closeOtherTabs: (paneIndex, id) => set(editPane(paneIndex, (p) => keepOnlyAnchor(p, id))),
  closeTabsToLeft: (paneIndex, id) => set(editPane(paneIndex, (p) => keepFromAnchor(p, id))),
  closeTabsToRight: (paneIndex, id) => set(editPane(paneIndex, (p) => keepThroughAnchor(p, id))),
  closeUnpinnedTabs: (paneIndex) => set(editPane(paneIndex, dropUnpinned)),
  closeTabEverywhere: (id) =>
    set((state) =>
      normalize(
        state.panes.map((p) => removeTab(p, id)),
        state.activePaneIndex,
      ),
    ),
  retitleTerminalTab: (sessionId, title) =>
    set((state) => ({
      panes: state.panes.map((p) => ({
        ...p,
        tabs: p.tabs.map((t) =>
          t.kind === 'terminal' && t.path === sessionId ? { ...t, title } : t,
        ),
      })),
    })),
  retitleAgentTab: (threadId, title) =>
    set((state) => ({
      panes: state.panes.map((p) => ({
        ...p,
        tabs: p.tabs.map((t) => (t.kind === 'agent' && t.path === threadId ? { ...t, title } : t)),
      })),
    })),
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
