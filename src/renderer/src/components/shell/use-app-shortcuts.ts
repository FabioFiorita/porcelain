import { trpcClient } from '@renderer/lib/trpc'
import { useTabsStore } from '@renderer/stores/tabs'
import { useEffect } from 'react'

/** Window-level shortcuts: Cmd+W (via main, see before-input-event) and Ctrl+Tab cycling. */
export function useAppShortcuts(): void {
  useEffect(() => {
    const subscription = trpcClient.appEvents.subscribe(undefined, {
      onData: (event) => {
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
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])
}
