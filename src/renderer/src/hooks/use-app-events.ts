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
        // the agent pushed a review-set change over MCP — refresh BOTH feature surfaces
        // (the sidebar list AND the inline reading surface) so they don't disagree until
        // the next 3s poll, matching useClearFeatureReview. Also refresh exploreFeature
        // to match the layers branch, which fans out to all three feature surfaces.
        await Promise.all([
          utils.featureView.invalidate(),
          utils.featureReading.invalidate(),
          utils.exploreFeature.invalidate(),
        ])
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
      if (event === 'diagnostics') {
        // the opt-in TS language server published new diagnostics — refetch the
        // repo-keyed lspDiagnostics query (a no-op when the feature is off, since
        // every lspDiagnostics query is then disabled and has nothing to refetch)
        await utils.lspDiagnostics.invalidate()
        return
      }
      if (event === 'layers') {
        // the agent retuned the flow layers over MCP — refresh the layer config and
        // every grouping surface that buckets files by them
        await Promise.all([
          utils.repoLayers.invalidate(),
          utils.gitFlow.invalidate(),
          utils.gitRangeFlow.invalidate(),
          utils.gitCommitFlow.invalidate(),
          utils.featureView.invalidate(),
          utils.featureReading.invalidate(),
          utils.exploreFeature.invalidate(),
        ])
        return
      }
      if (event === 'working-tree') {
        // a watched file changed on disk outside the app (most often the coding
        // agent editing in the terminal) — re-read the open documents and diffs so
        // the viewer isn't showing a stale version. (gitFlow self-polls every 3s.)
        await Promise.all([utils.readFile.invalidate(), utils.gitDiffFile.invalidate()])
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
