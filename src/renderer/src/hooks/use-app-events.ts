import { trpc, trpcClient } from '@renderer/lib/trpc'
import { useTabsStore } from '@renderer/stores/tabs'
import { useEffect } from 'react'

// The vanilla trpcClient is sanctioned here: electron-trpc subscriptions have no
// React-query hook, so the one app-wide event stream lives in this hook.
export function useAppEvents(): void {
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

    return () => subscription.unsubscribe()
  }, [utils])
}
