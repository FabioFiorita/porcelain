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

const SIDEBAR_TAB_KEYS: Record<string, SidebarTab | undefined> = {
  '1': 'files',
  '2': 'search',
  '3': 'changes',
  '4': 'history',
  '5': 'feature',
  '6': 'board',
  '7': 'terminal',
  '8': 'agent',
}

/**
 * Window-level shortcuts: Cmd+W (via main, see before-input-event), Ctrl+Tab cycling,
 * Cmd+1–8 sidebar tabs, and the context-aware "new" shortcuts for Board/Terminal (⌘N)
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
