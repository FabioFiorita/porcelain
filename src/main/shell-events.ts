import { BrowserWindow } from 'electron'

// The tiny Electron push channel that survives the daemon split: only events
// whose SOURCE is the shell ride it — Cmd+W tab-close routing (window.ts) and
// updater status changes (updater.ts). Everything else pushes from the daemon
// over the WS session (src/shared/ws-protocol.ts); the renderer consumes both
// in use-app-events.ts under one union type.
export type ShellEvent = 'close-tab' | 'update-status'

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
