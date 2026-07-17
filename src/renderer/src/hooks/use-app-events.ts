import type { AppEvent } from '@backend/app-events'
import type { ShellEvent } from '@main/shell-events'
import { onDaemonEvent, onDaemonReconnect } from '@renderer/lib/daemon'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc, trpc } from '@renderer/lib/trpc'
import { useTabsStore } from '@renderer/stores/tabs'
import { unreadTabFor, useUnreadStore } from '@renderer/stores/unread'
import { useEffect } from 'react'

/** The tRPC query-invalidation proxy — the value `trpc.useUtils()` returns. */
type Utils = ReturnType<typeof trpc.useUtils>
/** Same proxy for the shell router (updateStatus lives shell-side). */
type ShellUtils = ReturnType<typeof shellTrpc.useUtils>

// The renderer's push inbox, fed by TWO sources since the daemon split: the
// daemon's WS session (agent-channel refreshes + the watcher events, via
// lib/daemon.ts) and the tiny Electron shell-event channel (Cmd+W close-tab,
// updater status — `window.porcelain.onShellEvent`). One handler serves both
// under one union type so an event can't fall between the transports.
//
// `handle` maps each event to the work it triggers (a query invalidation, or for
// close-tab a store action). Its `Promise<unknown>` return type with no `default`
// is the exhaustiveness guard: a new event that isn't wired here lets the switch
// fall through to an implicit `return undefined`, which fails the annotated type at
// `pnpm typecheck` — the same compile-time net the Viewer's tab-kind switch uses. So
// adding a channel can't silently ship un-refreshed (the bug that left MCP-curated
// actions stale until a tab switch remounted the list).
function handle(
  event: AppEvent | ShellEvent,
  utils: Utils,
  shellUtils: ShellUtils,
): Promise<unknown> {
  switch (event) {
    case 'update-status':
      return shellUtils.updateStatus.invalidate()
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
    case 'evidence':
      // the agent authored/cleared loop evidence over MCP — refresh the Feature list
      // opener (metadata) and the open evidence view (full HTML).
      return Promise.all([utils.loopEvidence.invalidate(), utils.loopEvidenceHtml.invalidate()])
    case 'chat':
      // an agent (or human) posted to the agent-chat relay over MCP
      return utils.chatMessages.invalidate()
    case 'working-tree':
      // a watched file changed on disk outside the app (most often the coding
      // agent editing in the terminal) — re-read the open documents and diffs so
      // the viewer isn't showing a stale version. (gitFlow self-polls every 3s.)
      return Promise.all([
        utils.readFile.invalidate(),
        utils.previewHtml.invalidate(),
        utils.gitDiffFile.invalidate(),
      ])
    case 'agent-threads':
      // the Agent thread roster changed (create/rename/delete, or a status/model
      // flip) — refresh the roster query. (Phase E fills in the rest of the tab.)
      return utils.agentThreads.invalidate()
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
  const shellUtils = shellTrpc.useUtils()

  useEffect(() => {
    // The shell-event push channel is Electron-only (close-tab, update-status);
    // in the browser client there's no preload bridge, so skip it — the daemon WS
    // events below keep working untouched.
    const offShell = isBrowser
      ? () => {}
      : window.porcelain.onShellEvent(async (event) => {
          await handle(event, utils, shellUtils)
        })
    const offDaemon = onDaemonEvent(async (event) => {
      // Light the rail's unread dot for the agent-push events that carry an
      // attention signal (mark no-ops when that tab is already active).
      const tab = unreadTabFor(event)
      if (tab) useUnreadStore.getState().mark(tab)
      await handle(event, utils, shellUtils)
    })
    // The session came back after a daemon restart: a NEW process with empty
    // caches and no session state, so every server-derived query is stale. A
    // blanket invalidate is sanctioned here (like useQuickCommand's) because the
    // event is rare and genuinely global; the watch sets re-register inside the
    // ws client itself (lib/daemon.ts).
    const offReconnect = onDaemonReconnect(async () => {
      await utils.invalidate()
    })
    return () => {
      offShell()
      offDaemon()
      offReconnect()
    }
  }, [utils, shellUtils])
}
