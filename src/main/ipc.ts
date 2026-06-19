import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { BrowserWindow, ipcMain } from 'electron'
import { router } from './api'
import { subscribeAppEvents } from './app-events'
import { createTerminal, killTerminal, resizeTerminal, writeTerminal } from './terminal-manager'

// We own the tRPC transport instead of electron-trpc. The renderer's httpBatchLink
// serializes each call to an HTTP request and ships the bytes over `invoke('trpc')`;
// here we rebuild the Request and hand it to tRPC's official fetch adapter, so all
// protocol logic (batching, input decoding, error formatting) stays in tRPC.
export function registerTrpcHandler(): void {
  ipcMain.handle(
    'trpc',
    async (
      event,
      request: { url: string; method: string; headers: Record<string, string>; body?: string },
    ) => {
      const response = await fetchRequestHandler({
        endpoint: '/trpc',
        router,
        createContext: () => ({ sender: event.sender }),
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

// The dedicated bidirectional terminal channel: `create` returns a PTY id (request/
// response, so it's `handle`), while `write`/`resize`/`kill` are fire-and-forget
// `on`. PTY output rides `terminal:data` back to the calling window (see
// terminal-manager). Kept off tRPC on purpose — a terminal streams bytes both ways at
// keystroke frequency, which tRPC and the one-way app-event bus both fit poorly.
export function registerTerminalHandlers(): void {
  ipcMain.handle(
    'terminal:create',
    (event, opts: { cwd: string; initialInput?: string; cols?: number; rows?: number }): string =>
      createTerminal(event.sender, opts),
  )
  ipcMain.on('terminal:write', (_event, id: string, data: string) => writeTerminal(id, data))
  ipcMain.on('terminal:resize', (_event, id: string, cols: number, rows: number) =>
    resizeTerminal(id, cols, rows),
  )
  ipcMain.on('terminal:kill', (_event, id: string) => killTerminal(id))
}

// The custom window-control channel for the Linux/Windows renderer chrome (where the
// frame is ours, so minimize/maximize/close live in the titlebar). Each handler resolves
// the BrowserWindow from the calling WebContents so it targets the right window. Mirrors
// the fire-and-forget `on` + request/response `handle` split of the terminal channel.
export function registerWindowControlHandlers(): void {
  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.on('window:toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window?.isMaximized()) window.unmaximize()
    else window?.maximize()
  })
  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
  ipcMain.handle(
    'window:is-maximized',
    (event): boolean => BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false,
  )
}
