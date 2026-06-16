import { trpc } from '@renderer/lib/trpc'
import { useTabsStore } from '@renderer/stores/tabs'
import { useEffect } from 'react'

// The one main→renderer push channel (Cmd+W close-tab, update-status). It rides a
// dedicated IPC event channel (`window.porcelain.onAppEvent`), not tRPC — push
// doesn't fit the request/response transport, and a typed event channel is the
// idiomatic Electron pattern.
export function useAppEvents(): void {
  const utils = trpc.useUtils()

  useEffect(() => {
    return window.porcelain.onAppEvent(async (event) => {
      if (event === 'update-status') {
        await utils.updateStatus.invalidate()
        return
      }
      if (event === 'feature-view') {
        await utils.featureView.invalidate()
        return
      }
      if (event === 'comments') {
        // the agent resolved a comment over MCP — refresh the list + gutter markers
        await utils.reviewComments.invalidate()
        return
      }
      if (event === 'board') {
        // the agent created/moved/edited a card over MCP — refresh the board
        await utils.boardCards.invalidate()
        return
      }
      if (event !== 'close-tab') return
      const { panes, activePaneIndex, closeTab } = useTabsStore.getState()
      const activeTabId = panes[activePaneIndex]?.activeTabId
      if (activeTabId) closeTab(activePaneIndex, activeTabId)
      else window.close()
    })
  }, [utils])
}
