import { BrowserWindow } from 'electron'

// The tiny Electron push channel that survives the daemon split: only events
// whose SOURCE is the shell ride it — Cmd/Ctrl+W tab-close routing and window
// maximize/unmaximize (window.ts), plus updater status changes (updater.ts).
// Everything else pushes from the daemon over the WS session
// (src/shared/session contracts.ts); the renderer consumes both in use-shell-events.ts
// under one union type.
export type ShellEvent =
  | 'close-tab'
  | 'update-status'
  | 'maximized-changed'
  // The local child daemon came back on a NEW port. Local-bound windows are re-pointed
  // directly (`daemon-url-changed`); this is for the REMOTE-bound ones, which hold a
  // second connection to the local daemon for "This device" terminals and would
  // otherwise keep talking to a dead port (daemon.ts, pushLocalDaemonInfo).
  | 'local-daemon-changed'
  // File > Settings… (menu.ts) — open the Settings dialog in the focused window.
  | 'open-settings'
  // File > New Terminal / File > Quick Open… / View > Split Pane (menu.ts) — mirror the
  // renderer's own ⌘T / ⌘P / ⌘⇧S shortcuts (use-app-shortcuts.ts, file-finder.tsx) so the
  // menu item and the keyboard shortcut land on the same code path.
  | 'new-terminal'
  | 'quick-open'
  | 'split-pane'

/**
 * Broadcast a shell event to every open window (update-status is repo-agnostic,
 * so cross-window delivery is the point). The window-targeted `close-tab` is
 * sent directly to one WebContents in window.ts instead.
 */
export function broadcastShellEvent(event: ShellEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('shell-event', event)
  }
}
