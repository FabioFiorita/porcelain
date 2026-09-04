import type { SessionChange } from '@porcelain/contracts/session'
import { create } from 'zustand'
import { usePreferencesStore } from './preferences'

/**
 * The rail tabs that can carry an unread dot. A subset of `SidebarTab` — the
 * other tabs (files/search/history) get no agent-push signal (see the
 * event→tab mapping below and plan 035's decisions).
 */
export type UnreadTab = 'terminal' | 'changes'

const UNREAD_TABS: readonly UnreadTab[] = ['terminal', 'changes']

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
  unread: {
    terminal: false,
    changes: false,
  },
  mark: (tab: UnreadTab) => {
    // An event for the CURRENTLY active surface needs no dot — the view live-refreshes
    // in front of the user (plan 035, decision 3).
    if (usePreferencesStore.getState().sidebarTab === tab) {
      return
    }
    set((s) => ({ unread: { ...s.unread, [tab]: true } }))
  },
  clear: (tab: UnreadTab) => set((s) => ({ unread: { ...s.unread, [tab]: false } })),
}))

// The ONE clearing site: visiting a tab clears its dot. Both the rail click
// (app-sidebar's selectTab) and the Cmd+1–7 shortcut converge on
// preferences.setSidebarTab, so subscribing here — rather than wiring each call
// site — gives exactly one clearing point with no component involvement.
usePreferencesStore.subscribe((state, prev) => {
  if (state.sidebarTab !== prev.sidebarTab && isUnreadTab(state.sidebarTab)) {
    useUnreadStore.getState().clear(state.sidebarTab)
  }
})

/**
 * Which rail dot a session change lights, or `null` for signals that carry no
 * attention cue (plan 035, decision 2):
 * - `actions.changed` → Terminal
 * - `terminal.dev-servers-changed` → no dot (the Servers list is already live)
 * - tree / working-tree / content → Changes
 * - scope-only config → no dot
 */
export function unreadTabFor(change: SessionChange): UnreadTab | null {
  switch (change.kind) {
    case 'actions.changed':
      return 'terminal'
    case 'files.tree-changed':
    case 'files.content-changed':
    case 'git.working-tree-changed':
      // Tree or working-tree dirty after agent edits — soft cue on Changes (U9).
      return 'changes'
    case 'files.scope-changed':
      // Nav/grouping config — live-refresh without a rail unread dot.
      return null
    case 'terminal.dev-servers-changed':
      // A server you started yourself starting, printing a URL, or dying is not an unread
      // message — the Servers list is already live. No rail dot.
      return null
    case 'terminal.worktree-script-started':
      // The terminal is about to be focused for the human to watch; a dot on the surface
      // they are being sent to would be noise.
      return null
    case 'review.changed':
      // Comments refresh in place on the surface that owns them.
      return null
    case 'review.canvas-changed':
      // The Canvas changes the review walkthrough and its Changes ordering.
      return 'changes'
    case 'projects.inventory-changed':
      // Hub rows refresh in place; adding or removing one is not an unread work result.
      return null
  }
}
