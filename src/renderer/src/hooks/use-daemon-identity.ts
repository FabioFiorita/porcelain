import { trpc } from '@renderer/lib/trpc'

/** Identity of the daemon THIS window is bound to; nulls until it answers. */
export interface DaemonIdentityView {
  host: string | null
  platform: string | null
  version: string | null
}

/**
 * Who the daemon on the other end of this window's connection is (`daemonInfo`).
 *
 * Shares the query key with `useDaemonSkew` — same procedure, same options, so
 * TanStack serves both from one request. Keep the options identical if you touch
 * either: diverging them would double the boot request for no gain.
 *
 * Every field is nullable on purpose: a daemon older than the identity widening
 * returns `{ version }` alone, and the fallback for a missing host is the caller's
 * (the switcher shows "This device", the settings row shows the url).
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
