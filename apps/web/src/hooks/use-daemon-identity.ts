import { trpc } from '@renderer/lib/trpc'

/** Identity of the daemon THIS window is bound to; nulls until it answers. */
export interface DaemonIdentityView {
  host: string | null
  platform: string | null
  version: string | null
}

/**
 * Who the daemon on the other end of this window's connection is (`daemonInfo`).
 * Fields remain nullable only until the current daemon answers.
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
