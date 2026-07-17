import type { AppEvent } from '@shared/ws-protocol'
import { create } from 'zustand'
import { usePreferencesStore } from './preferences'

/**
 * The rail tabs that can carry an unread dot. A subset of `SidebarTab` — the
 * other tabs (files/search/changes/history) get no agent-push signal (see the
 * event→tab mapping below and plan 035's decisions).
 */
export type UnreadTab = 'feature' | 'board' | 'chat' | 'terminal'

const UNREAD_TABS: readonly UnreadTab[] = ['feature', 'board', 'chat', 'terminal']

export function isUnreadTab(tab: string): tab is UnreadTab {
  return (UNREAD_TABS as readonly string[]).includes(tab)
}

interface UnreadState {
  unread: Record<UnreadTab, boolean>
  /** Set the dot for `tab` — no-ops when `tab` is already the active sidebar tab. */
  mark: (tab: UnreadTab) => void
  clear: (tab: UnreadTab) => void
}

export const useUnreadStore = create<UnreadState>((set) => ({
  unread: { feature: false, board: false, chat: false, terminal: false },
  mark: (tab) => {
    // An event for the CURRENTLY active tab needs no dot — the view live-refreshes
    // in front of the user (plan 035, decision 3). Read the active tab straight
    // from the preferences store (sanctioned cross-store getState()).
    if (usePreferencesStore.getState().sidebarTab === tab) return
    set((s) => ({ unread: { ...s.unread, [tab]: true } }))
  },
  clear: (tab) => set((s) => ({ unread: { ...s.unread, [tab]: false } })),
}))

// The ONE clearing site: visiting a tab clears its dot. Both the rail click
// (app-sidebar's selectTab) and the Cmd+1–9 shortcut converge on
// preferences.setSidebarTab, so subscribing here — rather than wiring each call
// site — gives exactly one clearing point with no component involvement.
usePreferencesStore.subscribe((state, prev) => {
  if (state.sidebarTab !== prev.sidebarTab && isUnreadTab(state.sidebarTab)) {
    useUnreadStore.getState().clear(state.sidebarTab)
  }
})

/**
 * Which rail dot an agent-push event lights, or `null` for events that carry no
 * attention signal (plan 035, decision 2):
 * - `feature-view` / `artifact` / `evidence` / `comments` → Feature (all surface there)
 * - `board` → Board ; `chat` → Chat ; `actions` → Terminal
 * - `layers` (regroups the open view visibly) + the on-disk watches → no dot
 */
export function unreadTabFor(event: AppEvent): UnreadTab | null {
  switch (event) {
    case 'feature-view':
    case 'artifact':
    case 'evidence':
    case 'comments':
      return 'feature'
    case 'board':
      return 'board'
    case 'chat':
      return 'chat'
    case 'actions':
      return 'terminal'
    default:
      return null
  }
}
