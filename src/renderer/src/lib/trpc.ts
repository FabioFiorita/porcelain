import type { AppRouter } from '@backend/api'
import type { ShellRouter } from '@main/shell-api'
import type { ShellEvent } from '@main/shell-events'
import { createTRPCClient, httpBatchLink, type TRPCLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import { createContext } from 'react'
import { daemonBaseUrl, daemonToken } from './daemon'

/** The serialized-HTTP shuttle the shell tRPC channel rides over Electron IPC. */
type TrpcShuttle = (request: {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}) => Promise<{ status: number; headers: Record<string, string>; body: string }>

/**
 * The preload bridge after the daemon split: `trpcShell` carries a serialized
 * HTTP request across IPC for the SHELL router (Electron-native procedures —
 * the appRouter is real HTTP to the daemon, below), `onShellEvent` is the tiny
 * shell push channel (close-tab, update-status; everything else arrives over
 * the daemon WS session — lib/daemon.ts), and `daemon` hands over the daemon's
 * url plus restart notifications. See `src/preload/index.ts` for the matching
 * implementation.
 */
interface PorcelainBridge {
  trpcShell: TrpcShuttle
  onShellEvent: (callback: (event: ShellEvent) => void) => () => void
  daemon: {
    url: string
    /** The session token gating every daemon request (see backend/server.ts). */
    token: string
    onUrlChanged: (callback: (info: { url: string; token: string }) => void) => () => void
  }
  /** True only under the e2e harness; gates the terminal buffer-read test hook. */
  e2e: boolean
  /** The desktop OS the shell runs on (resolvePlatform in the preload). Absent on the browser client — read via `window.porcelain?.platform`. */
  platform: 'darwin' | 'linux' | 'win32'
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

// The appRouter link is a REAL http fetch to the daemon. The url is a fixed
// placeholder and the custom fetch rebases it onto `daemonBaseUrl()` per request,
// because the daemon's port changes when the shell restarts a crashed daemon —
// a url baked in at link creation would strand every query on the dead port.
// All protocol work (batching, GET/POST, input encoding, error shapes) stays in
// tRPC's httpBatchLink either way.
const DAEMON_PLACEHOLDER = 'http://daemon.invalid'

function rebaseToDaemon(input: RequestInfo | URL): string {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  return url.replace(DAEMON_PLACEHOLDER, daemonBaseUrl())
}

function appLinks(): TRPCLink<AppRouter>[] {
  return [
    httpBatchLink({
      url: `${DAEMON_PLACEHOLDER}/trpc`,
      // Every daemon request carries the session token — the daemon 401s
      // without it (loopback is reachable by any local webpage; see the
      // security note in backend/server.ts). Resolved per request like the
      // url, so a pushed refresh applies without rebuilding the link.
      headers: () => ({ authorization: `Bearer ${daemonToken()}` }),
      fetch: (input, init) => fetch(rebaseToDaemon(input), init),
    }),
  ]
}

// The shell link keeps the Stage-1 IPC shuttle: the request is serialized over
// `invoke('trpc-shell')` and main replays it through tRPC's official
// fetchRequestHandler — only bytes cross the boundary, never tRPC internals.
// The host in the url is ignored; the request never leaves the process. The
// channel name doubles as the endpoint path.
function shellLinks(): TRPCLink<ShellRouter>[] {
  return [
    httpBatchLink({
      url: 'http://localhost/trpc-shell',
      fetch: async (input, init) => {
        // The shell router rides the Electron preload bridge; in the browser client
        // there is no bridge. Fail loudly and instantly rather than hang — every
        // shell-only call site is supposed to be gated out (lib/platform isBrowser),
        // so reaching here is a bug, not an expected browser path.
        if (window.porcelain === undefined) {
          throw new Error('shell router is unavailable in the browser client')
        }
        const headers: Record<string, string> = {}
        new Headers(init?.headers).forEach((value, key) => {
          headers[key] = value
        })
        const response = await window.porcelain.trpcShell({
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
export const client = trpc.createClient({ links: appLinks() })

/** Vanilla client over an independent link — zustand stores and non-React code. */
export const trpcClient = createTRPCClient<AppRouter>({ links: appLinks() })

// createTRPCReact defaults to a module-level shared TRPCContext singleton. With
// two instances on the default context, nesting their Providers makes the inner
// one win for ALL hooks — every app `trpc.*` hook would silently resolve the
// shell client and hang on "No procedure found". Give the shell hooks their own
// context so the two never collide.
const shellTrpcContext = createContext<unknown>(null)

/** React hooks for the shell router (Electron-native procedures — see shell-api.ts). */
export const shellTrpc = createTRPCReact<ShellRouter>({ context: shellTrpcContext })

/** Client for the shell router's React-query integration. */
export const shellClient = shellTrpc.createClient({ links: shellLinks() })

/** Vanilla shell-router client — zustand stores and non-React code. */
export const shellTrpcClient = createTRPCClient<ShellRouter>({ links: shellLinks() })
