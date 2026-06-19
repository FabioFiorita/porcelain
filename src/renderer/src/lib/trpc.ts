import type { AppRouter } from '@main/api'
import type { AppEvent } from '@main/app-events'
import { createTRPCClient, httpBatchLink, type TRPCLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'

/**
 * The preload bridge. We own the Electron transport instead of depending on the
 * abandoned electron-trpc: `trpc` carries a serialized HTTP request across IPC,
 * `onAppEvent` is the one main→renderer push channel (replaces the old tRPC
 * subscription), and `terminal` is the dedicated bidirectional byte stream for the
 * embedded terminal. See `src/preload/index.ts` for the matching implementation.
 */
interface PorcelainBridge {
  trpc: (request: {
    url: string
    method: string
    headers: Record<string, string>
    body?: string
  }) => Promise<{ status: number; headers: Record<string, string>; body: string }>
  onAppEvent: (callback: (event: AppEvent) => void) => () => void
  terminal: {
    create: (opts: {
      cwd: string
      initialInput?: string
      cols?: number
      rows?: number
    }) => Promise<string>
    write: (id: string, data: string) => void
    resize: (id: string, cols: number, rows: number) => void
    kill: (id: string) => void
    onData: (callback: (id: string, data: string) => void) => () => void
    onExit: (callback: (id: string, exitCode: number) => void) => () => void
  }
  /** True only under the e2e harness; gates the terminal buffer-read test hook. */
  e2e: boolean
}

declare global {
  interface Window {
    porcelain: PorcelainBridge
    /**
     * Test-only: serialize the on-screen text of the terminal at `index` (creation
     * order). Installed by the terminal registry only under e2e — the WebGL renderer
     * paints to a canvas, so `.xterm-rows` can't be scraped for output.
     */
    __porcelainTerminalText?: (index: number) => string
  }
}

// One terminating link for the whole app. tRPC's httpBatchLink does all the
// protocol work (batching, GET/POST, input encoding, error shapes); our custom
// `fetch` only shuttles the bytes over IPC, and the main process replays them
// through tRPC's official fetchRequestHandler. The host in the URL is ignored —
// the request never leaves the process.
function electronLinks(): TRPCLink<AppRouter>[] {
  return [
    httpBatchLink({
      url: 'http://localhost/trpc',
      fetch: async (input, init) => {
        const headers: Record<string, string> = {}
        new Headers(init?.headers).forEach((value, key) => {
          headers[key] = value
        })
        const response = await window.porcelain.trpc({
          url: input.toString(),
          method: init?.method ?? 'GET',
          headers,
          body: typeof init?.body === 'string' ? init.body : undefined,
        })
        return new Response(response.body, {
          status: response.status,
          headers: response.headers,
        })
      },
    }),
  ]
}

/** React hooks — use in components (via the hooks layer). */
export const trpc = createTRPCReact<AppRouter>()

/** Client for the React-query integration. */
export const client = trpc.createClient({ links: electronLinks() })

/** Vanilla client over an independent link — zustand stores and non-React code. */
export const trpcClient = createTRPCClient<AppRouter>({ links: electronLinks() })
