import { useEnvironmentSessionsRevision } from '@renderer/lib/environment-sessions'
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
  // Hub inventories learn secondary daemon UUIDs after their connection-id queries resolve.
  // Subscribe here so every owner hook (Actions, Files, Git, Search) rebinds its query key and
  // notification bridge when that alias becomes canonical, including connection-id -> UUID
  // timing and alias cleanup.
  useEnvironmentSessionsRevision()
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

/**
 * The DISPLAY name of the Environment this window is bound to: the human's nickname when
 * they set one, otherwise the daemon's machine name. Null until the daemon answers, or on a
 * daemon too old to know the procedure — callers fall back to `useDaemonIdentity().host`.
 *
 * Deliberately NOT folded into `useDaemonIdentity`: that hook's `host` is a cache/scope key
 * on ~30 query families and is cached forever, while a nickname is display text that changes
 * the moment someone renames the Environment.
 */
export function useEnvironmentName(): string | null {
  const { data } = trpc.environmentIdentity.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  })
  return data?.name ?? null
}
