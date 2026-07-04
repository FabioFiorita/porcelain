export type AppEvent =
  | 'close-tab'
  | 'update-status'
  | 'feature-view'
  | 'comments'
  | 'board'
  | 'actions'
  | 'layers'
  | 'artifact'
  | 'working-tree'
  | 'file-tree'

const listeners = new Set<(event: AppEvent) => void>()

// This broadcasts to every window, which is INTENTIONAL and harmless under
// multi-window: agent-channel events (update-status/feature-view/comments/board/
// actions) are per-repo keyed, so a cross-window delivery is just a no-op refetch.
// Window-specific events (close-tab, working-tree, file-tree) bypass this and are
// sent directly to a single WebContents instead.
export function emitAppEvent(event: AppEvent): void {
  for (const listener of listeners) listener(event)
}

export function subscribeAppEvents(listener: (event: AppEvent) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
