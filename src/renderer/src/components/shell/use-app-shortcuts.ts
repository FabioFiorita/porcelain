import {
  ctrlIsPrimary,
  isModExclusive,
  isTerminalTarget,
  isTextEntry,
} from '@renderer/lib/keyboard'
import { spawnTerminal } from '@renderer/lib/terminal-actions'
import { useCardDraftStore } from '@renderer/stores/card-draft'
import { type SidebarTab, usePreferencesStore } from '@renderer/stores/preferences'
import { useTabsStore } from '@renderer/stores/tabs'
import { useEffect } from 'react'

// Must match the rail order in app-sidebar.tsx (agentic loop: Files → Agent →
// Changes → Feature → History → Search → Board → Chat → Terminal).
const SIDEBAR_TAB_KEYS: Record<string, SidebarTab | undefined> = {
  '1': 'files',
  '2': 'agent',
  '3': 'changes',
  '4': 'feature',
  '5': 'history',
  '6': 'search',
  '7': 'board',
  '8': 'chat',
  '9': 'terminal',
}

/**
 * Window-level shortcuts: close-tab (Ctrl+W here on Linux/Windows, yielding to a focused
 * terminal; macOS Cmd+W goes via main's before-input-event instead), Ctrl+Tab cycling,
 * Cmd+1–9 sidebar tabs, and the context-aware "new" shortcuts for Board/Terminal (⌘N)
 * plus ⌘T for a terminal anywhere. Files' ⌘N/⌘⇧N/⌘D/⌘⌫ and the Agent tab's ⌘N (new
 * thread) live in dedicated components (FileCommands / AgentCommands) instead — those go
 * through tRPC hooks, which only a component may touch.
 */
export function useAppShortcuts(): void {
  useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent): Promise<void> => {
      if (e.key === 'Tab' && e.ctrlKey) {
        e.preventDefault()
        useTabsStore.getState().cycleTab(e.shiftKey ? -1 : 1)
        return
      }
      // Ctrl+W closes the active tab (or the window when none is open) on Linux/Windows,
      // where the renderer owns it — macOS keeps the main-process path (before-input-event
      // → shell-event 'close-tab'), so gate this on ctrlIsPrimary to avoid double-handling
      // Cmd+W. Yield to a focused embedded terminal: let Ctrl+W fall through to xterm so
      // readline gets its kill-word.
      if (ctrlIsPrimary && isModExclusive(e) && e.key.toLowerCase() === 'w' && !e.shiftKey) {
        if (isTerminalTarget(e.target)) return
        e.preventDefault()
        const { panes, activePaneIndex, closeTab } = useTabsStore.getState()
        const activeTabId = panes[activePaneIndex]?.activeTabId
        if (activeTabId) closeTab(activePaneIndex, activeTabId)
        else window.close()
        return
      }
      // Cmd+Shift+S splits the active tab to the side (mirrors "Open to the Side").
      // Matched by physical key (`e.code`) so it fires regardless of keyboard layout.
      if (isModExclusive(e) && e.shiftKey && !e.altKey && e.code === 'KeyS') {
        const { panes, activePaneIndex, openTabToSide } = useTabsStore.getState()
        const pane = panes[activePaneIndex]
        const active = pane?.tabs.find((t) => t.id === pane.activeTabId)
        if (active) {
          e.preventDefault()
          openTabToSide({ ...active, preview: false })
        }
        return
      }
      if (isModExclusive(e) && !e.altKey && !e.shiftKey) {
        const tab = SIDEBAR_TAB_KEYS[e.key]
        if (tab) {
          e.preventDefault()
          usePreferencesStore.getState().setSidebarTab(tab)
          return
        }
      }
      // Context-aware "new". ⌘T always spawns a terminal; ⌘N follows the active sidebar
      // tab (Board → new card, Terminal → new terminal). Files' ⌘N is owned by
      // FileCommands. Skipped while typing in a real field (but not the terminal).
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !isTextEntry(e.target)) {
        // In the browser client the primary modifier is Ctrl, which the shell itself uses
        // (Ctrl+T transpose, Ctrl+N history) — yield these to a focused PTY. The Electron
        // shell keeps the deliberate carve-out (Cmd is free in the terminal, so ⌘T/⌘N
        // spawn over it).
        if (ctrlIsPrimary && isTerminalTarget(e.target)) return
        const key = e.key.toLowerCase()
        if (key === 't' && !e.shiftKey) {
          e.preventDefault()
          await spawnTerminal()
          return
        }
        if (key === 'n' && !e.shiftKey) {
          const sidebarTab = usePreferencesStore.getState().sidebarTab
          if (sidebarTab === 'board') {
            e.preventDefault()
            useCardDraftStore.getState().open({ title: '', body: '', status: 'todo' })
            return
          }
          if (sidebarTab === 'terminal') {
            e.preventDefault()
            await spawnTerminal()
            return
          }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
