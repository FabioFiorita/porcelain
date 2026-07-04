import type { AppEvent } from '../shared/ws-protocol'

// The daemon's process-wide event bus. The event union lives in the shared WS
// protocol (the session channel is how events reach the renderer); `close-tab`
// and `update-status` are NOT app events — they're Electron shell events
// (src/main/shell-events.ts) because Cmd+W routing and the updater stay shell-side.
export type { AppEvent }

const listeners = new Set<(event: AppEvent) => void>()

// This broadcasts to every session, which is INTENTIONAL and harmless under
// multi-window: agent-channel events (feature-view/comments/board/actions/layers/
// artifact) are per-repo keyed, so a cross-window delivery is just a no-op refetch.
// Session-specific events (working-tree, file-tree) bypass this and are sent
// directly to the registering session instead (see file-watch.ts).
export function emitAppEvent(event: AppEvent): void {
  for (const listener of listeners) listener(event)
}

export function subscribeAppEvents(listener: (event: AppEvent) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
