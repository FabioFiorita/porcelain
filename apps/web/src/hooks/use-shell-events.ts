import type { ShellEvent } from '@main/shell-events'
import { isBrowser } from '@renderer/lib/platform'
import { spawnTerminal } from '@renderer/lib/terminal-actions'
import { shellTrpc } from '@renderer/lib/trpc'
import { useFileFinderStore } from '@renderer/stores/file-finder'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { useTabsStore } from '@renderer/stores/tabs'
import { useEffect } from 'react'

/** Same proxy for the shell router (updateStatus lives shell-side). */
type ShellUtils = ReturnType<typeof shellTrpc.useUtils>

/**
 * Electron shell-event channel only (Cmd+W, updater, menu commands). Daemon domain
 * change signals and reconnect recovery live on `useSessionRuntime` — one session
 * socket, no dual path.
 *
 * `handle`'s `Promise<unknown>` return with NO `default` case is deliberate: an
 * unwired event falls through to an implicit `return undefined`, which fails the
 * annotated type at `pnpm typecheck` — so a new shell event can't silently ship
 * unhandled.
 */
function handle(event: ShellEvent, shellUtils: ShellUtils): Promise<unknown> {
  switch (event) {
    case 'update-status':
      return shellUtils.updateStatus.invalidate()
    case 'maximized-changed':
      // the OS maximized/unmaximized the frameless window (Linux/Windows) — refresh
      // the query so the custom controls flip the maximize/restore glyph
      return shellUtils.windowIsMaximized.invalidate()
    case 'local-daemon-changed':
      // the local child daemon restarted on a new port and this window is bound to a
      // REMOTE one — refresh the endpoint so its "This device" terminal session
      // re-points instead of talking to the dead port (useLocalDaemon re-points on data)
      return shellUtils.localDaemon.invalidate()
    case 'close-tab': {
      // Cmd+W routed from the main process before-input-event — close the active
      // tab, or the window if it was the last one.
      const { panes, activePaneIndex, closeTab } = useTabsStore.getState()
      const activeTabId = panes[activePaneIndex]?.activeTabId
      if (activeTabId) closeTab(activePaneIndex, activeTabId)
      else window.close()
      return Promise.resolve()
    }
    case 'open-settings':
      // File > Settings… (menu.ts) — open the same dialog the sidebar gear drives.
      useSettingsDialogStore.getState().openTo()
      return Promise.resolve()
    case 'new-terminal':
      // File > New Terminal (menu.ts) — same spawn the ⌘T shortcut and the Terminal
      // tab's "+" button use.
      return spawnTerminal()
    case 'quick-open':
      // File > Quick Open… (menu.ts) — open the same popup ⌘P toggles, mirroring the
      // titlebar search bar's use of this store.
      useFileFinderStore.getState().setOpen(true)
      return Promise.resolve()
    case 'split-pane': {
      // View > Split Pane (menu.ts) — same as the ⌘⇧S shortcut (use-app-shortcuts.ts):
      // open the active tab again in a new pane beside it.
      const { panes, activePaneIndex, openTabToSide } = useTabsStore.getState()
      const pane = panes[activePaneIndex]
      const active = pane?.tabs.find((t) => t.id === pane.activeTabId)
      if (active) openTabToSide({ ...active, preview: false })
      return Promise.resolve()
    }
  }
}

/**
 * Mount the Electron shell-event channel. Daemon session signals are handled by
 * `useSessionRuntime` on the shared session runtime.
 */
export function useShellEvents(): void {
  const shellUtils = shellTrpc.useUtils()

  useEffect(() => {
    // The shell-event push channel is Electron-only (close-tab, update-status);
    // in the browser client there's no preload bridge, so skip it.
    if (isBrowser) return
    return window.porcelain.onShellEvent(async (event) => {
      await handle(event, shellUtils)
    })
  }, [shellUtils])
}
