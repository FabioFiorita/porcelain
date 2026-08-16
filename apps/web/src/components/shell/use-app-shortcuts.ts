import { toastUserActionError } from '@renderer/hooks/mutation-error'
import {
  ctrlIsPrimary,
  isModExclusive,
  isTerminalTarget,
  isTextEntry,
} from '@renderer/lib/keyboard'
import { spawnTerminal, toggleTerminalPanel } from '@renderer/lib/terminal-actions'
import { type SidebarTab, usePreferencesStore } from '@renderer/stores/preferences'
import { useTabsStore } from '@renderer/stores/tabs'
import { runUserAction } from '@shared/background'
import { useEffect } from 'react'

// Must match the displayed shortcuts in surface-sidebar.tsx. Cmd+6 belongs to the bottom
// Terminal panel, so Tasks uses 5 and Canvas keeps its explicit 7 slot.
export const SIDEBAR_TAB_KEYS: Record<string, SidebarTab | undefined> = {
  '1': 'files',
  '2': 'changes',
  '3': 'history',
  '4': 'search',
  '5': 'tasks',
  '7': 'canvas',
}

/**
 * Window-level shortcuts: close-tab (Ctrl+W here on Linux/Windows, yielding to a focused
 * terminal; macOS Cmd+W goes via main's before-input-event instead), Ctrl+Tab cycling,
 * Cmd+1–5 sidebar tabs, Cmd+6 for the bottom terminal panel, Cmd+7 for Canvas, and the context-aware "new"
 * shortcut for files (⌘N)
 * plus ⌘T for a terminal anywhere. Files' ⌘N/⌘⇧N/⌘D/⌘⌫ live in a dedicated component
 * (FileCommands) instead — those go through tRPC hooks, which only a component may touch.
 */
export function useAppShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Tab' && e.ctrlKey) {
        e.preventDefault()
        useTabsStore.getState().cycleTab(e.shiftKey ? -1 : 1)
        return
      }
      // Ctrl+W closes the active tab (or the window when none is open) on Linux/Windows,
      // where the renderer owns it — macOS keeps the main-process path (before-input-event
      // → shell-event 'close-tab'), so gate this on ctrlIsPrimary to avoid double-handling
      // Cmd+W. Yield to a focused embedded terminal: let Ctrl+W fall through to Ghostty so
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
        if (e.key === '6') {
          e.preventDefault()
          runUserAction(
            () => toggleTerminalPanel(),
            (error) => toastUserActionError('Open terminal', error),
          )
          return
        }
        const tab = SIDEBAR_TAB_KEYS[e.key]
        if (tab) {
          e.preventDefault()
          usePreferencesStore.getState().setSidebarTab(tab)
          usePreferencesStore.getState().setRightSidebarOpen(true)
          return
        }
      }
      // Context-aware "new". ⌘T always spawns a terminal. Files' ⌘N is owned by
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
          runUserAction(
            () => spawnTerminal(),
            (error) => {
              toastUserActionError('Open terminal', error)
            },
          )
          return
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
