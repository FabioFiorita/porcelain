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

/** Build a client for one verified route. Temporary pairing probes never enter the cache. */
export function createDaemonClient(baseUrl: string, token: string): DaemonClient {
  return createTRPCUntypedClient<AnyTRPCRouter>({
    links: [
      httpBatchLink({
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
