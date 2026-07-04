import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { ipcMain } from 'electron'
import { shellRouter } from './shell-api'

interface SerializedRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

// The surviving Electron IPC shuttle: only the SHELL router rides it now (native
// dialogs, window management, the updater, plugin installers — procedures that
// need Electron or the calling window). The appRouter moved to the daemon and the
// renderer reaches it over real HTTP (lib/trpc.ts → 127.0.0.1:<port>/trpc).
//
// We own the transport instead of electron-trpc. The renderer's httpBatchLink
// serializes each call to an HTTP request and ships the bytes over
// `invoke('trpc-shell')`; here we rebuild the Request and hand it to tRPC's
// official fetch adapter, so all protocol logic (batching, input decoding, error
// formatting) stays in tRPC.
export function registerTrpcHandler(): void {
  ipcMain.handle('trpc-shell', async (event, request: SerializedRequest) => {
    const response = await fetchRequestHandler({
      endpoint: '/trpc-shell',
      router: shellRouter,
      // The calling window rides in as ctx.sender — the sanctioned per-call way
      // for a shell procedure (windowInit) to act on its own window.
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
  })
}
