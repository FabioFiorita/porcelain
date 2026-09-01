import type { AppRouter } from '@backend/api'
import type { ShellRouter } from '@main/shell-api'
import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import type { PorcelainBridge } from '@preload/bridge'
import { createTRPCClient, httpBatchLink, type TRPCLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import { createContext } from 'react'
import { daemonBaseUrl, daemonToken } from './daemon'
import { contractValidationLink } from './trpc-contract-link'

declare global {
  interface Window {
    porcelain: PorcelainBridge
    /**
     * Test-only: serialize the on-screen text of the terminal at `index` (creation
     * order). Installed by the terminal registry only under e2e — the canvas terminal
     * has no text DOM that can be scraped for output.
     */
    __porcelainTerminalText?: (index: number) => string
    /**
     * Test/marketing-only: set the terminal font size on every live instance and re-fit.
     * Installed by the terminal registry only under e2e.
     */
    __porcelainSetTerminalFontSize?: (size: number) => void
  }
}

// The appRouter link is a REAL http fetch to the daemon. The url is a fixed
// placeholder and the custom fetch rebases it onto `daemonBaseUrl()` per request,
// because the daemon's port changes when the shell restarts a crashed daemon —
// a url baked in at link creation would strand every query on the dead port.
// All protocol work (batching, GET/POST, input encoding, error shapes) stays in
// tRPC's httpBatchLink either way.
const DAEMON_PLACEHOLDER = 'http://daemon.invalid'

function rebaseTo(input: RequestInfo | URL, baseUrl: string): string {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  return url.replace(DAEMON_PLACEHOLDER, baseUrl)
}

/**
 * appRouter links pointed at ONE daemon, resolved per request. Parameterized by session
 * (rather than hardwired to `primary`) so a window bound to a remote daemon can also hold
 * a client for the local one — see `lib/local-daemon.ts`. Both getters are read per
 * request, so a re-pointed session applies without rebuilding the link.
 */
function appLinksFor(baseUrl: () => string, token: () => string): TRPCLink<AppRouter>[] {
  return [
    // Above the transport: every daemon call is contract-checked in and out, for the React
    // client, the vanilla client, and the local-daemon client alike.
    contractValidationLink<AppRouter>(),
    httpBatchLink({
      url: `${DAEMON_PLACEHOLDER}/trpc`,
      // Every daemon request carries the session token — the daemon 401s
      // without it (loopback is reachable by any local webpage; see the
      // security note in backend/server.ts) — and the protocol version this
      // build speaks, which the daemon boundary checks before dispatching.
      headers: () => ({
        authorization: `Bearer ${token()}`,
        [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION),
      }),
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(rebaseTo(input, baseUrl()), init),
    }),
  ]
}

function appLinks(): TRPCLink<AppRouter>[] {
  return appLinksFor(daemonBaseUrl, daemonToken)
}

/** A vanilla appRouter client for a NON-primary daemon session (the local one). */
export function createAppClientFor(session: {
  baseUrl: () => string
  token: () => string
}): ReturnType<typeof createTRPCClient<AppRouter>> {
  return createTRPCClient<AppRouter>({ links: appLinksFor(session.baseUrl, session.token) })
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
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
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
        // The shared shuttle schema admits only GET|POST (httpBatchLink verbs). Narrow
        // before invoke so a future verb cannot smuggle past the bridge types.
        const methodToken = (init?.method ?? 'GET').toUpperCase()
        if (methodToken !== 'GET' && methodToken !== 'POST') {
          throw new Error(`shell shuttle does not support method ${methodToken}`)
        }
        const response = await window.porcelain.trpcShell({
          url: input.toString(),
          method: methodToken,
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

/**
 * A link for the shell router, named here so a test harness can stub the shell transport
 * without importing `@main/*` itself — this module is already the Web boundary that owns
 * that import, and the architecture gate counts every other one.
 */
export type ShellTrpcLink = TRPCLink<ShellRouter>

/** Vanilla shell-router client — zustand stores and non-React code. */
export const shellTrpcClient = createTRPCClient<ShellRouter>({ links: shellLinks() })
