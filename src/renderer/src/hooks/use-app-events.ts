import type { AppEvent } from '@main/app-events'
import { trpc } from '@renderer/lib/trpc'
import { useTabsStore } from '@renderer/stores/tabs'
import { useEffect } from 'react'

/** The tRPC query-invalidation proxy — the value `trpc.useUtils()` returns. */
type Utils = ReturnType<typeof trpc.useUtils>

// The one main→renderer push channel (Cmd+W close-tab plus every agent-channel
// refresh). It rides a dedicated IPC event channel (`window.porcelain.onAppEvent`),
// not tRPC — push doesn't fit the request/response transport, and a typed event
// channel is the idiomatic Electron pattern.
//
// `handle` maps each event to the work it triggers (a query invalidation, or for
// close-tab a store action). Its `Promise<unknown>` return type with no `default`
// is the exhaustiveness guard: a new AppEvent that isn't wired here lets the switch
// fall through to an implicit `return undefined`, which fails the annotated type at
// `pnpm typecheck` — the same compile-time net the Viewer's tab-kind switch uses. So
// adding a channel can't silently ship un-refreshed (the bug that left MCP-curated
// actions stale until a tab switch remounted the list).
function handle(event: AppEvent, utils: Utils): Promise<unknown> {
  switch (event) {
    case 'update-status':
      return utils.updateStatus.invalidate()
    case 'feature-view':
      // the agent pushed a review-set change over MCP — refresh BOTH feature surfaces
      // (the sidebar list AND the inline reading surface) so they don't disagree until
      // the next 3s poll, matching useClearFeatureReview. Also refresh exploreFeature
      // to match the layers branch, which fans out to all three feature surfaces.
      return Promise.all([
        utils.featureView.invalidate(),
        utils.featureReading.invalidate(),
        utils.exploreFeature.invalidate(),
      ])
    case 'comments':
      // the agent resolved a comment over MCP — refresh the list + gutter markers
      return utils.reviewComments.invalidate()
    case 'board':
      // the agent created/moved/edited a card over MCP — refresh the board
      return utils.boardCards.invalidate()
    case 'actions':
      // the agent curated a saved action over MCP — refresh the Actions list so the
      // new/edited command shows up live, not on the next remount.
      return utils.actions.invalidate()
    case 'layers':
      // the agent retuned the flow layers over MCP — refresh the layer config and
      // every grouping surface that buckets files by them
      return Promise.all([
        utils.repoLayers.invalidate(),
        utils.gitFlow.invalidate(),
        utils.gitRangeFlow.invalidate(),
        utils.gitCommitFlow.invalidate(),
        utils.featureView.invalidate(),
        utils.featureReading.invalidate(),
        utils.exploreFeature.invalidate(),
      ])
    case 'artifact':
      // the agent authored/cleared a feature artifact over MCP — refresh the Feature
      // list opener (metadata) and the open artifact view (full HTML).
      return Promise.all([
        utils.featureArtifact.invalidate(),
        utils.featureArtifactHtml.invalidate(),
      ])
    case 'working-tree':
      // a watched file changed on disk outside the app (most often the coding
      // agent editing in the terminal) — re-read the open documents and diffs so
      // the viewer isn't showing a stale version. (gitFlow self-polls every 3s.)
      return Promise.all([utils.readFile.invalidate(), utils.gitDiffFile.invalidate()])
    case 'file-tree':
      // a watched dir changed on disk outside the app (the coding agent adding or
      // removing files in the terminal) — refresh the lazy tree rows, the pinned
      // list, and the working-tree grouping so the new/gone file shows up live.
      return Promise.all([
        utils.readDir.invalidate(),
        utils.pinnedEntries.invalidate(),
        utils.gitFlow.invalidate(),
      ])
    case 'close-tab': {
      // Cmd+W routed from the main process before-input-event — close the active
      // tab, or the window if it was the last one.
      const { panes, activePaneIndex, closeTab } = useTabsStore.getState()
      const activeTabId = panes[activePaneIndex]?.activeTabId
      if (activeTabId) closeTab(activePaneIndex, activeTabId)
      else window.close()
      return Promise.resolve()
    }
  }
}

export function useAppEvents(): void {
  const utils = trpc.useUtils()

  useEffect(() => {
    return window.porcelain.onAppEvent(async (event) => {
      await handle(event, utils)
    })
  }, [utils])
}
