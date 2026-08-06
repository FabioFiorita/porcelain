import { REQUEST_TIMEOUT_MS } from '@porcelain/client-runtime/session-protocol'
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
 * probe hung instead of failing, so the app never accumulated the failures that trigger it. Abort
 * at `REQUEST_TIMEOUT_MS` — the same budget the socket seam already gives one request/reply — and
 * still honor whatever signal tRPC (or React Query's own cancellation) passed in.
 */
export function fetchWithTimeout(
  input: RequestInfo | URL | string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const passedSignal = init?.signal
  if (passedSignal != null) {
    if (passedSignal.aborted) controller.abort()
    else passedSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return fetch(input as RequestInfo | URL, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer)
  })
}

/** Build a client for one verified route. Temporary pairing probes never enter the cache. */
export function createDaemonClient(baseUrl: string, token: string): DaemonClient {
  return createTRPCUntypedClient<AnyTRPCRouter>({
    links: [
      httpBatchLink({
        fetch: fetchWithTimeout,
        headers: () => ({ authorization: `Bearer ${token}` }),
        url: `${baseUrl}/trpc`,
      }),
    ],
  })
}

/** One cached client per environment, rebuilt when its `baseUrl` or token changes. */
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
