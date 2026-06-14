import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { type BrowserWindow, ipcMain } from 'electron'
import { router } from './api'
import { subscribeAppEvents } from './app-events'

// We own the tRPC transport instead of electron-trpc. The renderer's httpBatchLink
// serializes each call to an HTTP request and ships the bytes over `invoke('trpc')`;
// here we rebuild the Request and hand it to tRPC's official fetch adapter, so all
// protocol logic (batching, input decoding, error formatting) stays in tRPC.
export function registerTrpcHandler(): void {
  ipcMain.handle(
    'trpc',
    async (
      _event,
      request: { url: string; method: string; headers: Record<string, string>; body?: string },
    ) => {
      const response = await fetchRequestHandler({
        endpoint: '/trpc',
        router,
        createContext: () => ({}),
        req: new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        }),
      })
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.text(),
      }
    },
  )
}

// The single main→renderer push channel (replaces the old `appEvents` tRPC
// subscription): forward every app event to the window until it closes.
export function pipeAppEvents(window: BrowserWindow): void {
  const unsubscribe = subscribeAppEvents((event) => {
    if (!window.isDestroyed()) window.webContents.send('app-event', event)
  })
  window.on('closed', unsubscribe)
}
