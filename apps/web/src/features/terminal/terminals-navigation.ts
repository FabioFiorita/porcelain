import { targetedTab } from '@renderer/stores/hub-tabs'
import { useTabsStore } from '@renderer/stores/tabs'

/**
 * Open the daemon-wide Terminals board in the Viewer. Target-free like Tasks: the board
 * spans every Project on this daemon, so it must not follow the Hub selection.
 *
 * A `terminals` tab is exclusive (`stores/tabs.ts`), so this reveals the one that already
 * exists — activating its pane — instead of opening a second board over whatever the other
 * pane is showing.
 */
export function openTerminalsBoard(): void {
  useTabsStore
    .getState()
    .openTab(targetedTab('terminals', 'terminals', { title: 'Terminals' }, null))
}
