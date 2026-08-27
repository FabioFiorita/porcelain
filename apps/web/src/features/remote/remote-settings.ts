import type { AuthorizedClient, PairingGrant } from '@porcelain/contracts/remote'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import {
  daemonScopeForEnvironment,
  type EnvironmentSession,
  thisDeviceClient,
  useEnvironmentSessionsRevision,
} from '@renderer/lib/environment-sessions'
import { trpc } from '@renderer/lib/trpc'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchRemoteAccessStatus,
  fetchRemoteCloudflareStatus,
  fetchRemoteLanStatus,
  fetchRemoteTailnetStatus,
  issueRemotePairingLink,
  type RemoteDaemonScope,
  remoteAccessStatusQueryOptions,
  remoteCloudflareStatusQueryOptions,
  remoteStatusQueryKey,
  revokeRemoteAuthorizedClient,
  revokeRemotePairingLink,
  setRemoteCloudflareBind,
  setRemoteLanBind,
  setRemoteTailnetBind,
} from './remote-data'

export interface AccessStatus {
  pairings: PairingGrant[]
  clients: AuthorizedClient[]
  connected: number
  adminTokenPath: string
}

export interface LanStatus {
  enabled: boolean
  url: string | null
  numericUrl: string | null
  /** Why nothing bound: 'in-use' = share port squatted (likely a stale daemon). */
  error: 'in-use' | null
  /** True when PORCELAIN_LAN_BIND=1 force-enabled the bind at boot (not togglable). */
  envForced: boolean
  /** Port this daemon binds for LAN share (PORCELAIN_DAEMON_PORT or 43117). */
  port: number
}

export interface TailnetStatus {
  enabled: boolean
  url: string | null
  /** Why nothing bound: 'in-use' = share port squatted (likely a stale daemon). */
  error: 'in-use' | null
  /** True when PORCELAIN_TAILNET_BIND=1 force-enabled the bind at boot (not togglable). */
  envForced: boolean
  /** Port this daemon binds for tailnet share (PORCELAIN_DAEMON_PORT or 43117). */
  port: number
}

export interface CloudflareStatus {
  enabled: boolean
  url: string | null
  managed: boolean
  /** Why nothing bound: 'unavailable' = cloudflared missing, 'conflict' = another tunnel. */
  error: 'unavailable' | 'conflict' | null
  /** True when PORCELAIN_CLOUDFLARE_BIND=1 force-enabled the bind at boot (not togglable). */
  envForced: boolean
}

/** Sharing belongs to this physical device, not to whichever Environment the window presents. */
function useShareDaemon(): {
  client: EnvironmentSession['client']
  daemon: RemoteDaemonScope
} {
  const identity = useDaemonIdentity()
  const revision = useEnvironmentSessionsRevision()
  const primaryClient = trpc.useUtils().client
  const owner = thisDeviceClient(primaryClient, revision)
  return {
    client: owner.client,
    daemon: daemonScopeForEnvironment(owner.environmentId, identity),
  }
}

export function useAccessStatus(): AccessStatus | undefined {
  const { daemon, client } = useShareDaemon()
  const { data } = useQuery({
    queryKey: remoteStatusQueryKey(daemon, 'accessStatus'),
    queryFn: () => fetchRemoteAccessStatus(client),
    ...remoteAccessStatusQueryOptions,
  })
  return data
}

export function useLanStatus(): LanStatus | undefined {
  const { daemon, client } = useShareDaemon()
  const { data } = useQuery({
    queryKey: remoteStatusQueryKey(daemon, 'lanStatus'),
    queryFn: () => fetchRemoteLanStatus(client),
  })
  return data
}

export function useTailnetStatus(): TailnetStatus | undefined {
  const { daemon, client } = useShareDaemon()
  const { data } = useQuery({
    queryKey: remoteStatusQueryKey(daemon, 'tailnetStatus'),
    queryFn: () => fetchRemoteTailnetStatus(client),
  })
  return data
}

export function useCloudflareStatus(): CloudflareStatus | undefined {
  const { daemon, client } = useShareDaemon()
  const { data } = useQuery({
    queryKey: remoteStatusQueryKey(daemon, 'cloudflareStatus'),
    queryFn: () => fetchRemoteCloudflareStatus(client),
    ...remoteCloudflareStatusQueryOptions,
  })
  return data
}

export function useIssuePairingLink(): {
  issue: (input: { label: string; baseUrl: string }) => Promise<{ url: string }>
  isPending: boolean
} {
  const { daemon, client } = useShareDaemon()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: { label: string; baseUrl: string }) =>
      issueRemotePairingLink(client, queryClient, daemon, input),
    onError: onMutationError('Create connection link'),
  })
  return {
    issue: (input: { label: string; baseUrl: string }): Promise<{ url: string }> =>
      mutation.mutateAsync(input),
    isPending: mutation.isPending,
  }
}

export function useRevokePairingLink(): {
  revoke: (id: string) => void
  pendingId: string | null
} {
  const { daemon, client } = useShareDaemon()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (id: string) => revokeRemotePairingLink(client, queryClient, daemon, id),
    onError: onMutationError('Revoke connection link'),
  })
  return {
    revoke: (id: string): void => {
      mutation.mutate(id)
    },
    pendingId: mutation.isPending ? (mutation.variables ?? null) : null,
  }
}

export function useRevokeAuthorizedClient(): {
  revoke: (id: string) => void
  pendingId: string | null
} {
  const { daemon, client } = useShareDaemon()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (id: string) => revokeRemoteAuthorizedClient(client, queryClient, daemon, id),
    onError: onMutationError('Revoke device'),
  })
  return {
    revoke: (id: string): void => {
      mutation.mutate(id)
    },
    pendingId: mutation.isPending ? (mutation.variables ?? null) : null,
  }
}

export function useSetLanBind(): {
  setEnabled: (enabled: boolean) => void
  isPending: boolean
} {
  const { daemon, client } = useShareDaemon()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (enabled: boolean) => setRemoteLanBind(client, queryClient, daemon, enabled),
    onError: onMutationError('Toggle local network sharing'),
  })
  return {
    setEnabled: (enabled: boolean): void => {
      mutation.mutate(enabled)
    },
    isPending: mutation.isPending,
  }
}

export function useSetTailnetBind(): {
  setEnabled: (enabled: boolean) => void
  isPending: boolean
} {
  const { daemon, client } = useShareDaemon()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (enabled: boolean) => setRemoteTailnetBind(client, queryClient, daemon, enabled),
    onError: onMutationError('Toggle Tailscale sharing'),
  })
  return {
    setEnabled: (enabled: boolean): void => {
      mutation.mutate(enabled)
    },
    isPending: mutation.isPending,
  }
}

export function useSetCloudflareBind(): {
  setEnabled: (enabled: boolean) => void
  isPending: boolean
} {
  const { daemon, client } = useShareDaemon()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (enabled: boolean) => setRemoteCloudflareBind(client, queryClient, daemon, enabled),
    onError: onMutationError('Toggle Cloudflare sharing'),
  })
  return {
    setEnabled: (enabled: boolean): void => {
      mutation.mutate(enabled)
    },
    isPending: mutation.isPending,
  }
}
