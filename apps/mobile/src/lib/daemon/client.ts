import { REQUEST_TIMEOUT_MS } from '@porcelain/client-runtime/session/transport'
import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { createTRPCUntypedClient, httpBatchLink } from '@trpc/client'
import type { AnyTRPCRouter } from '@trpc/server'

import type { EnvironmentId, PairedEnvironment } from './environment'

/**
 * Untyped on purpose: the daemon's `AppRouter` type cannot cross into this project (it drags
 * 45 daemon modules through `tsc`), so the contract is the zod descriptors in `procedure.ts`
 * and every response is parsed at the seam. Batching, error shapes and the URL contract are
 * still tRPC's — only the compile-time router type is ours to replace.
 */
export type DaemonClient = ReturnType<typeof createTRPCUntypedClient<AnyTRPCRouter>>

type CachedClient = { baseUrl: string; token: string; client: DaemonClient }

const clients = new Map<string, CachedClient>()

/**
 * Plain `fetch` has no connect timeout: a LAN address dialed from off that LAN (phone now on
 * cellular, or a different Wi-Fi) is still routable, so the socket sits half-open until the OS's
 * own timeout — tens of seconds to minutes, not the few seconds a reachability check needs. That
 * silence, not a missing endpoint-walk, is why failover reads as "the app never noticed": every
 * probe hung instead of failing, so the app never accumulated the failures that trigger it.
 *
 * `PROBE_TIMEOUT_MS` is a CONNECT-failure detector, not a request budget — it exists only for
 * `bootstrapAtEndpoint` in `provider.tsx`, the reachability walk that needs exactly that signal to
 * fail over. Regular app traffic (everything through `getDaemonClient`) keeps a much larger
 * budget: `gitGenerateCommitMessage`/`gitGenerateCommitGroups` (`procedures/changes.ts`)
 * legitimately run tens of seconds against a daemon that is very much alive, and the short
 * deadline would abort them mid-mutation and misreport a live daemon as unreachable. The split is
 * by *use* (probe vs. traffic), not by procedure name — a long-call allowlist would just be this
 * bug again with extra steps the next time some other call turns out to be slow.
 */
export const PROBE_TIMEOUT_MS = REQUEST_TIMEOUT_MS
const DEFAULT_TIMEOUT_MS = 120_000

/** Still honors whatever signal tRPC (or React Query's own cancellation) passed in. */
export function createTimeoutFetch(
  timeoutMs: number,
): (input: RequestInfo | URL | string, init?: RequestInit) => Promise<Response> {
  return (input, init) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const passedSignal = init?.signal
    if (passedSignal != null) {
      if (passedSignal.aborted) controller.abort()
      else passedSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }
    return fetch(input as RequestInfo | URL, { ...init, signal: controller.signal }).finally(() => {
      clearTimeout(timer)
    })
  }
}

/**
 * Build a client for one verified route. Temporary pairing probes never enter the cache.
 * `timeoutMs` defaults to the regular-traffic budget; pass `PROBE_TIMEOUT_MS` for a
 * reachability/bootstrap probe that must fail fast instead of waiting out a real mutation.
 */
export function createDaemonClient(
  baseUrl: string,
  token: string,
  options?: { timeoutMs?: number },
): DaemonClient {
  return createTRPCUntypedClient<AnyTRPCRouter>({
    links: [
      httpBatchLink({
        fetch: createTimeoutFetch(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        // The bearer token authenticates the request; the protocol header declares which
        // wire this build speaks, so a phone that skipped an update fails clearly instead
        // of sending shapes the daemon no longer accepts.
        headers: () => ({
          authorization: `Bearer ${token}`,
          [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION),
        }),
        url: `${baseUrl}/trpc`,
      }),
    ],
  })
}

/** One cached client per environment, rebuilt when its `baseUrl` or token changes. Regular
 * app traffic — the ordinary-budget client, never the reachability probe's short one. */
export function getDaemonClient(env: PairedEnvironment): DaemonClient {
  const cached = clients.get(env.id)
  if (cached !== undefined && cached.baseUrl === env.baseUrl && cached.token === env.token) {
    return cached.client
  }

  const client = createDaemonClient(env.baseUrl, env.token)
  clients.set(env.id, { baseUrl: env.baseUrl, client, token: env.token })
  return client
}

export function forgetDaemonClient(id: EnvironmentId): void {
  clients.delete(id)
}
