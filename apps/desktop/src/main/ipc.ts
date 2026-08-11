import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { ipcMain } from 'electron'
import { type TrpcShellResponse, trpcShellRequestSchema } from '../preload/bridge'
import { shellRouter } from './shell-api'

/**
 * What a renderer gets back when its shuttle payload is not a shuttle request. The
 * renderer's httpBatchLink turns this into a normal HTTP failure, so a malformed call
 * fails the same way everywhere instead of throwing inside `new Request(...)` — or worse,
 * reaching tRPC's fetch adapter with a url the renderer never meant to send.
 */
function malformedRequestResponse(): TrpcShellResponse {
  return {
    status: 400,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ error: { message: 'malformed trpc-shell request' } }),
  }
}

// The surviving Electron IPC shuttle: only the SHELL router rides it now (native
// dialogs, window management, the updater — procedures that
// need Electron or the calling window). The appRouter moved to the daemon and the
// renderer reaches it over real HTTP (lib/trpc.ts → 127.0.0.1:<port>/trpc).
//
// We own the transport instead of electron-trpc. The renderer's httpBatchLink
// serializes each call to an HTTP request and ships the bytes over
// `invoke('trpc-shell')`; here we rebuild the Request and hand it to tRPC's
// official fetch adapter, so all protocol logic (batching, input decoding, error
// formatting) stays in tRPC.
export function registerTrpcHandler(): void {
  ipcMain.handle('trpc-shell', async (event, payload: unknown): Promise<TrpcShellResponse> => {
    // IPC erases types: `payload` is whatever the renderer world sent. Parse before a
    // Request exists, and never dispatch what did not parse.
    const parsed = trpcShellRequestSchema.safeParse(payload)
    if (!parsed.success) return malformedRequestResponse()
    const request = parsed.data
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
