import { targetedTab } from '@renderer/stores/hub-tabs'
import { useTabsStore } from '@renderer/stores/tabs'

/**
 * Open the daemon-wide Terminals board in the Viewer. Target-free like Tasks: the board
 * spans every Project on this daemon, so it must not follow the Hub selection.
 */
export function openTerminalsBoard(): void {
  useTabsStore
    .getState()
    .openTab(targetedTab('terminals', 'terminals', { title: 'Terminals' }, null))
}
