import { trpc } from '@renderer/lib/trpc'

/** Identity of the daemon THIS window is bound to; nulls until it answers. */
export interface DaemonIdentityView {
  host: string | null
  platform: string | null
  version: string | null
}

/**
 * Who the daemon on the other end of this window's connection is (`daemonInfo`).
 * Shares the query key with `useDaemonSkew` — keep the options identical, or
 * TanStack's dedup splits into two boot requests.
 *
 * Every field is nullable: an older daemon returns `{ version }` alone, so the
 * caller supplies the missing-host fallback ("This device", or the url).
 */
export function useDaemonIdentity(): DaemonIdentityView {
  const { data } = trpc.daemonInfo.useQuery(undefined, {
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  })
  return {
    host: data?.host ?? null,
    platform: data?.platform ?? null,
    version: data?.version ?? null,
  }
}
