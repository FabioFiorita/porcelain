import {
  type AccessStatusOutput,
  type FunnelStatusOutput,
  type IssuePairingLinkOutput,
  type LanStatusOutput,
  remoteProcedures,
  type TailnetStatusOutput,
} from '@porcelain/contracts/remote'
import type { trpcClient } from '@renderer/lib/trpc'
import type { QueryClient } from '@tanstack/react-query'

/**
 * Web Remote daemon transport (REM-004).
 *
 * Feature keys isolate listener/access status by daemon identity. Procedure-name
 * React Query hooks are not used — callers go through the vanilla client.
 */

export type RemoteDaemonScope = { readonly host: string | null; readonly version: string | null }

export type RemoteStatusName = 'accessStatus' | 'lanStatus' | 'tailnetStatus' | 'funnelStatus'

type RemoteDaemonClient = Pick<
  typeof trpcClient,
  | 'accessStatus'
  | 'lanStatus'
  | 'tailnetStatus'
  | 'funnelStatus'
  | 'issuePairingLink'
  | 'revokePairingLink'
  | 'revokeAuthorizedClient'
  | 'setLanBind'
  | 'setTailnetBind'
  | 'setFunnelBind'
>

export const remoteAccessStatusQueryOptions = {
  refetchInterval: 15_000,
  staleTime: 0,
} as const

export const remoteFunnelStatusQueryOptions = {
  staleTime: 10_000,
  refetchOnWindowFocus: true,
} as const

export function remoteStatusQueryKey<Name extends RemoteStatusName>(
  daemon: RemoteDaemonScope,
  name: Name,
): readonly ['remote', Name, RemoteDaemonScope] {
  return ['remote', name, { host: daemon.host, version: daemon.version }] as const
}

function scopeOf(daemon: RemoteDaemonScope): RemoteDaemonScope {
  return { host: daemon.host, version: daemon.version }
}

async function invalidateRemoteStatus(
  queryClient: QueryClient,
  daemon: RemoteDaemonScope,
  name: RemoteStatusName,
): Promise<void> {
  await queryClient.invalidateQueries({
    exact: true,
    queryKey: remoteStatusQueryKey(scopeOf(daemon), name),
  })
}

export async function fetchRemoteAccessStatus(
  client: Pick<RemoteDaemonClient, 'accessStatus'>,
): Promise<AccessStatusOutput> {
  return remoteProcedures.accessStatus.output.parse(await client.accessStatus.query())
}

export async function fetchRemoteLanStatus(
  client: Pick<RemoteDaemonClient, 'lanStatus'>,
): Promise<LanStatusOutput> {
  return remoteProcedures.lanStatus.output.parse(await client.lanStatus.query())
}

export async function fetchRemoteTailnetStatus(
  client: Pick<RemoteDaemonClient, 'tailnetStatus'>,
): Promise<TailnetStatusOutput> {
  return remoteProcedures.tailnetStatus.output.parse(await client.tailnetStatus.query())
}

export async function fetchRemoteFunnelStatus(
  client: Pick<RemoteDaemonClient, 'funnelStatus'>,
): Promise<FunnelStatusOutput> {
  return remoteProcedures.funnelStatus.output.parse(await client.funnelStatus.query())
}

export async function issueRemotePairingLink(
  client: Pick<RemoteDaemonClient, 'issuePairingLink'>,
  queryClient: QueryClient,
  daemon: RemoteDaemonScope,
  input: { label: string; baseUrl: string },
): Promise<Pick<IssuePairingLinkOutput, 'url'>> {
  const wire = remoteProcedures.issuePairingLink.input.parse(input)
  const result = remoteProcedures.issuePairingLink.output.parse(
    await client.issuePairingLink.mutate(wire),
  )
  await invalidateRemoteStatus(queryClient, daemon, 'accessStatus')
  return { url: result.url }
}

export async function revokeRemotePairingLink(
  client: Pick<RemoteDaemonClient, 'revokePairingLink'>,
  queryClient: QueryClient,
  daemon: RemoteDaemonScope,
  id: string,
): Promise<void> {
  const wire = remoteProcedures.revokePairingLink.input.parse(id)
  remoteProcedures.revokePairingLink.output.parse(await client.revokePairingLink.mutate(wire))
  await invalidateRemoteStatus(queryClient, daemon, 'accessStatus')
}

export async function revokeRemoteAuthorizedClient(
  client: Pick<RemoteDaemonClient, 'revokeAuthorizedClient'>,
  queryClient: QueryClient,
  daemon: RemoteDaemonScope,
  id: string,
): Promise<void> {
  const wire = remoteProcedures.revokeAuthorizedClient.input.parse(id)
  remoteProcedures.revokeAuthorizedClient.output.parse(
    await client.revokeAuthorizedClient.mutate(wire),
  )
  await invalidateRemoteStatus(queryClient, daemon, 'accessStatus')
}

export async function setRemoteLanBind(
  client: Pick<RemoteDaemonClient, 'setLanBind'>,
  queryClient: QueryClient,
  daemon: RemoteDaemonScope,
  enabled: boolean,
): Promise<void> {
  const wire = remoteProcedures.setLanBind.input.parse(enabled)
  remoteProcedures.setLanBind.output.parse(await client.setLanBind.mutate(wire))
  await invalidateRemoteStatus(queryClient, daemon, 'lanStatus')
}

export async function setRemoteTailnetBind(
  client: Pick<RemoteDaemonClient, 'setTailnetBind'>,
  queryClient: QueryClient,
  daemon: RemoteDaemonScope,
  enabled: boolean,
): Promise<void> {
  const wire = remoteProcedures.setTailnetBind.input.parse(enabled)
  remoteProcedures.setTailnetBind.output.parse(await client.setTailnetBind.mutate(wire))
  await invalidateRemoteStatus(queryClient, daemon, 'tailnetStatus')
}

export async function setRemoteFunnelBind(
  client: Pick<RemoteDaemonClient, 'setFunnelBind'>,
  queryClient: QueryClient,
  daemon: RemoteDaemonScope,
  enabled: boolean,
): Promise<void> {
  const wire = remoteProcedures.setFunnelBind.input.parse(enabled)
  remoteProcedures.setFunnelBind.output.parse(await client.setFunnelBind.mutate(wire))
  await invalidateRemoteStatus(queryClient, daemon, 'funnelStatus')
}
