import { trpc, trpcClient } from '@renderer/lib/trpc'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useTabsStore } from '@renderer/stores/tabs'
import { useEffect } from 'react'

const SIDEBAR_TAB_KEYS: Record<string, 'files' | 'changes' | 'history' | undefined> = {
  '1': 'files',
  '2': 'changes',
  '3': 'history',
}

/** Window-level shortcuts: Cmd+W (via main, see before-input-event), Ctrl+Tab cycling, Cmd+1/2/3 sidebar tabs. */
export function useAppShortcuts(): void {
  const utils = trpc.useUtils()

  useEffect(() => {
    const subscription = trpcClient.appEvents.subscribe(undefined, {
      onData: async (event) => {
        if (event === 'update-status') {
          await utils.updateStatus.invalidate()
          return
        }
        if (event !== 'close-tab') return
        const { activeTabId, closeTab } = useTabsStore.getState()
        if (activeTabId) closeTab(activeTabId)
        else window.close()
      },
    })

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Tab' && e.ctrlKey) {
        e.preventDefault()
        useTabsStore.getState().cycleTab(e.shiftKey ? -1 : 1)
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

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [utils])
}
