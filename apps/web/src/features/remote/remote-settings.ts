import type { AuthorizedClient, PairingGrant } from '@porcelain/contracts/remote'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { trpc } from '@renderer/lib/trpc'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchRemoteAccessStatus,
  fetchRemoteFunnelStatus,
  fetchRemoteLanStatus,
  fetchRemoteTailnetStatus,
  issueRemotePairingLink,
  type RemoteDaemonScope,
  remoteAccessStatusQueryOptions,
  remoteFunnelStatusQueryOptions,
  remoteStatusQueryKey,
  revokeRemoteAuthorizedClient,
  revokeRemotePairingLink,
  setRemoteFunnelBind,
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

export interface FunnelStatus {
  enabled: boolean
  url: string | null
  managed: boolean
  /** Why nothing bound: 'unavailable' = tailscale/funnel missing, 'conflict' = port squatted. */
  error: 'unavailable' | 'conflict' | null
  /** True when PORCELAIN_FUNNEL_BIND=1 force-enabled the bind at boot (not togglable). */
  envForced: boolean
}

function daemonScope(identity: { host: string | null; version: string | null }): RemoteDaemonScope {
  return { host: identity.host, version: identity.version }
}

export function useAccessStatus(): AccessStatus | undefined {
  const daemon = daemonScope(useDaemonIdentity())
  const client = trpc.useUtils().client
  const { data } = useQuery({
    queryKey: remoteStatusQueryKey(daemon, 'accessStatus'),
    queryFn: () => fetchRemoteAccessStatus(client),
    ...remoteAccessStatusQueryOptions,
  })
  return data
}

export function useLanStatus(): LanStatus | undefined {
  const daemon = daemonScope(useDaemonIdentity())
  const client = trpc.useUtils().client
  const { data } = useQuery({
    queryKey: remoteStatusQueryKey(daemon, 'lanStatus'),
    queryFn: () => fetchRemoteLanStatus(client),
  })
  return data
}

export function useTailnetStatus(): TailnetStatus | undefined {
  const daemon = daemonScope(useDaemonIdentity())
  const client = trpc.useUtils().client
  const { data } = useQuery({
    queryKey: remoteStatusQueryKey(daemon, 'tailnetStatus'),
    queryFn: () => fetchRemoteTailnetStatus(client),
  })
  return data
}

export function useFunnelStatus(): FunnelStatus | undefined {
  const daemon = daemonScope(useDaemonIdentity())
  const client = trpc.useUtils().client
  const { data } = useQuery({
    queryKey: remoteStatusQueryKey(daemon, 'funnelStatus'),
    queryFn: () => fetchRemoteFunnelStatus(client),
    ...remoteFunnelStatusQueryOptions,
  })
  return data
}

export function useIssuePairingLink(): {
  issue: (input: { label: string; baseUrl: string }) => Promise<{ url: string }>
  isPending: boolean
} {
  const daemon = daemonScope(useDaemonIdentity())
  const queryClient = useQueryClient()
  const client = trpc.useUtils().client
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
  const daemon = daemonScope(useDaemonIdentity())
  const queryClient = useQueryClient()
  const client = trpc.useUtils().client
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
  const daemon = daemonScope(useDaemonIdentity())
  const queryClient = useQueryClient()
  const client = trpc.useUtils().client
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
  const daemon = daemonScope(useDaemonIdentity())
  const queryClient = useQueryClient()
  const client = trpc.useUtils().client
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
  const daemon = daemonScope(useDaemonIdentity())
  const queryClient = useQueryClient()
  const client = trpc.useUtils().client
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

export function useSetFunnelBind(): {
  setEnabled: (enabled: boolean) => void
  isPending: boolean
} {
  const daemon = daemonScope(useDaemonIdentity())
  const queryClient = useQueryClient()
  const client = trpc.useUtils().client
  const mutation = useMutation({
    mutationFn: (enabled: boolean) => setRemoteFunnelBind(client, queryClient, daemon, enabled),
    onError: onMutationError('Update Internet sharing'),
  })
  return {
    setEnabled: (enabled: boolean): void => {
      mutation.mutate(enabled)
    },
    isPending: mutation.isPending,
  }
}
