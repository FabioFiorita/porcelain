export type AppEvent = 'close-tab' | 'update-status' | 'feature-view' | 'comments'

const listeners = new Set<(event: AppEvent) => void>()

export function emitAppEvent(event: AppEvent): void {
  for (const listener of listeners) listener(event)
}

export function subscribeAppEvents(listener: (event: AppEvent) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
