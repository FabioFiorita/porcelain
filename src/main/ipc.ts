import type { AnyTRPCRouter, inferRouterContext } from '@trpc/server'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { type BrowserWindow, type IpcMainInvokeEvent, ipcMain } from 'electron'
import { router } from '../backend/api'
import { subscribeAppEvents } from '../backend/app-events'
import {
  createTerminal,
  killTerminal,
  resizeTerminal,
  writeTerminal,
} from '../backend/terminal-manager'
import { shellRouter } from './shell-api'

interface SerializedRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

// We own the tRPC transport instead of electron-trpc. The renderer's httpBatchLink
// serializes each call to an HTTP request and ships the bytes over `invoke(channel)`;
// here we rebuild the Request and hand it to tRPC's official fetch adapter, so all
// protocol logic (batching, input decoding, error formatting) stays in tRPC.
function registerTrpcChannel<TRouter extends AnyTRPCRouter>(
  channel: string,
  trpcRouter: TRouter,
  createContext: (event: IpcMainInvokeEvent) => inferRouterContext<TRouter>,
): void {
  ipcMain.handle(channel, async (event, request: SerializedRequest) => {
    const response = await fetchRequestHandler({
      endpoint: `/${channel}`,
      router: trpcRouter,
      createContext: () => createContext(event),
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
  })
}

// Two routers, two channels: the Electron-free appRouter (no context — its
// procedures never see the caller) and the shell router (Electron-native
// procedures, which get the calling window as ctx.sender). Both ride Electron
// IPC in Stage 1; the appRouter channel becomes real HTTP in Stage 2.
export function registerTrpcHandler(): void {
  registerTrpcChannel('trpc', router, () => ({}))
  registerTrpcChannel('trpc-shell', shellRouter, (event) => ({ sender: event.sender }))
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
