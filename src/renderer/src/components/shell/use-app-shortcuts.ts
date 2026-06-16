import { usePreferencesStore } from '@renderer/stores/preferences'
import { useTabsStore } from '@renderer/stores/tabs'
import { useEffect } from 'react'

const SIDEBAR_TAB_KEYS: Record<
  string,
  'files' | 'changes' | 'history' | 'feature' | 'board' | undefined
> = {
  '1': 'files',
  '2': 'changes',
  '3': 'history',
  '4': 'feature',
  '5': 'board',
}

/** Window-level shortcuts: Cmd+W (via main, see before-input-event), Ctrl+Tab cycling, Cmd+1/2/3/4/5 sidebar tabs. */
export function useAppShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Tab' && e.ctrlKey) {
        e.preventDefault()
        useTabsStore.getState().cycleTab(e.shiftKey ? -1 : 1)
        return
      }
      // Cmd+Shift+S splits the active tab to the side (mirrors "Open to the Side").
      // Matched by physical key (`e.code`) so it fires regardless of keyboard layout.
      if (e.metaKey && e.shiftKey && !e.ctrlKey && !e.altKey && e.code === 'KeyS') {
        const { panes, activePaneIndex, openTabToSide } = useTabsStore.getState()
        const pane = panes[activePaneIndex]
        const active = pane?.tabs.find((t) => t.id === pane.activeTabId)
        if (active) {
          e.preventDefault()
          openTabToSide({ ...active, preview: false })
        }
        return
      }
      if (e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const tab = SIDEBAR_TAB_KEYS[e.key]
        if (tab) {
          e.preventDefault()
          usePreferencesStore.getState().setSidebarTab(tab)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
