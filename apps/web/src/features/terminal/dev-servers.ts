import type { HubTarget } from '@porcelain/client-runtime/projects'
import {
  devServerMutations,
  devServersNotificationEffects,
  devServersQuery,
} from '@porcelain/client-runtime/terminal'
import type { DevServer, DevServerTarget } from '@porcelain/contracts/terminal'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { primary } from '@renderer/lib/daemon'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { environmentClientFor, environmentSessionFor } from '@renderer/lib/environment-sessions'
import { trpc } from '@renderer/lib/trpc'
import { useHubTarget } from '@renderer/stores/hub-selection'
import { settleBackground } from '@shared/background'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { devServersQueryKey, invalidateDevServerQueries } from './dev-server-query-key'

/**
 * Web adapter for the daemon-owned development-server roster.
 *
 * Everything here is a read or an explicit command — there is no client-side process state to
 * keep. That is the point: the daemon owns the process, so a reload, a Worktree switch, or a
 * closed window costs nothing but a refetch.
 */

/**
 * Narrow a Hub target to the wire target. The Environment is dropped deliberately, not
 * forgotten: the daemon answering the call IS the Environment, so sending it would be a second
 * claim about which machine this is — and the strict wire schema rejects it for that reason.
 */
export function devServerTargetOf(target: HubTarget): DevServerTarget {
  return { projectId: target.projectId, worktreeId: target.worktreeId, path: target.path }
}

function useDaemonScope(): DaemonScope {
  const daemon = useDaemonIdentity()
  return { host: daemon.host, version: daemon.version }
}

export type DevServerRoster = Readonly<{
  servers: DevServer[]
  /**
   * Whether the daemon has actually answered. Load state is not cosmetic here: rendering
   * "nothing is running" while the roster is still in flight tells the human the opposite of
   * the truth about their own processes, which is the one thing this surface must never do.
   */
  loaded: boolean
}>

/** The development servers the daemon holds for one Worktree. Empty without a target. */
export function useDevServers(target: HubTarget | null): DevServerRoster {
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const owner = environmentClientFor(target?.environmentId ?? null, utils.client)
  const identity =
    target === null
      ? devServersQuery({ projectId: 'none', worktreeId: 'none' })
      : devServersQuery(target)

  const query = useQuery({
    queryKey: devServersQueryKey(daemon, identity),
    queryFn: async (): Promise<DevServer[]> => {
      if (target === null) return []
      if (owner === null) throw new Error('The target Environment is offline.')
      return owner.client.devServers.query({ target: devServerTargetOf(target) })
    },
    enabled: target !== null && owner !== null,
  })

  return { servers: query.data ?? [], loaded: target === null || query.isSuccess }
}

export type DevServerCommands = Readonly<{
  start: (input: { target: DevServerTarget; label: string; command: string }) => Promise<void>
  stop: (server: DevServer) => Promise<void>
  dismiss: (server: DevServer) => Promise<void>
}>

/**
 * The three explicit lifetime commands. Each one refetches exactly the Worktree roster it
 * changed; none of them is optimistic, because "is it running?" is the daemon's answer to give.
 */
export function useDevServerCommands(): DevServerCommands {
  const daemon = useDaemonScope()
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()
  const target = useHubTarget()
  const owner = environmentClientFor(target?.environmentId ?? null, utils.client)

  async function settle(queries: readonly ReturnType<typeof devServersQuery>[]): Promise<void> {
    await invalidateDevServerQueries(queryClient, daemon, queries)
  }

  return {
    start: async (input) => {
      if (owner === null) throw new Error('The target Environment is offline.')
      await owner.client.startDevServer.mutate(input)
      await settle(devServerMutations.start.affectedQueries(input))
    },
    stop: async (server) => {
      if (owner === null) throw new Error('The target Environment is offline.')
      await owner.client.stopDevServer.mutate({ id: server.id })
      await settle(devServerMutations.stop.affectedQueries({ id: server.id, ...server.target }))
    },
    dismiss: async (server) => {
      if (owner === null) throw new Error('The target Environment is offline.')
      await owner.client.dismissDevServer.mutate({ id: server.id })
      await settle(devServerMutations.dismiss.affectedQueries({ id: server.id, ...server.target }))
    },
  }
}

/**
 * Live roster freshness. Subscribed once from the shell: a server that starts, prints its URL,
 * or dies while you are reading something else still updates the list you come back to.
 */
export function useDevServersNotificationSubscription(): void {
  const queryClient = useQueryClient()
  const daemon = useDaemonIdentity()
  const host = daemon.host
  const version = daemon.version
  const target = useHubTarget()
  const sessionOwner = environmentSessionFor(target?.environmentId ?? null)

  useEffect(() => {
    if (sessionOwner === null) return
    const scope: DaemonScope = { host, version }
    return (sessionOwner.session ?? primary).onChange((change) => {
      if (change.kind !== 'terminal.dev-servers-changed') return
      settleBackground(
        invalidateDevServerQueries(queryClient, scope, devServersNotificationEffects(change)),
        'notification',
      )
    })
  }, [queryClient, host, sessionOwner, version])
}
