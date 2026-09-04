import { hubInventoryQuery } from '@porcelain/client-runtime/projects'
import type { HubInventory } from '@porcelain/contracts/projects'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import {
  browserEnvironmentConnections,
  ensureEnvironmentSession,
  registerEnvironmentAlias,
  setPrimaryEnvironmentId,
  THIS_DEVICE_CONNECTION_ID,
  useEnvironmentSessionsRevision,
} from '@renderer/lib/environment-sessions'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpcClient, trpc } from '@renderer/lib/trpc'
import { type QueryClient, useQueries, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { hubInventoryOnDaemon } from './project-transport'

/** One live inventory plus the shell identity needed to route its actions safely. */
export type HubInventoryView = Readonly<{
  environmentId: string | null
  current: boolean
  /** Cached last-known metadata; actions must stay disabled until its daemon reconnects. */
  offline?: boolean
  inventory: HubInventory
}>

export type HubInventoriesState = Readonly<{
  inventories: readonly HubInventoryView[]
  status: 'loading' | 'ready' | 'error'
}>

/**
 * Electron's Hub tree reads through the shell router (one IPC round trip fans out to every
 * connected Environment), never the per-Environment `hubInventoryQuery()` shape the browser
 * uses — so a mutation invalidating only that shape (project-data.ts's `invalidateProjectQueries`)
 * leaves this query stale on Electron until `staleTime` (30s) or a window-focus refetch catches
 * up. Exported so that invalidation can target it directly instead of duplicating the literal.
 */
export const SHELL_HUB_INVENTORIES_QUERY_KEY = ['shell', 'hubInventories'] as const

/**
 * Refresh just this Electron window's Hub source after a mutation on its current daemon.
 * Keep the all-Environment read for initial loading; replacing a known cache row here avoids
 * turning a local interaction into a probe of every saved remote Environment.
 */
export async function refreshCurrentShellHubInventory(queryClient: QueryClient): Promise<void> {
  const current = await shellTrpcClient.currentHubInventory.query()
  if (current === null) return
  queryClient.setQueryData<readonly HubInventoryView[]>(
    SHELL_HUB_INVENTORIES_QUERY_KEY,
    (cached) => {
      // With no existing query, leave initial loading to the all-Environment query. Otherwise a
      // mutation before the Hub mounts would make its first view permanently miss secondary rows.
      if (cached === undefined) return cached
      const previousCurrentIndex = cached.findIndex((source) => source.current)
      if (previousCurrentIndex === -1) return [...cached, current]
      return cached.map((source, index) => (index === previousCurrentIndex ? current : source))
    },
  )
}

/** Live Hub inventories plus a truthful state when no Environment can currently answer. */
export function useHubInventoriesState(): HubInventoriesState {
  const daemon = useDaemonIdentity()
  const environmentSessionsRevision = useEnvironmentSessionsRevision()
  const client = trpc.useUtils().client
  const identity = hubInventoryQuery()
  const browserQuery = useQuery({
    enabled: isBrowser,
    queryFn: async (): Promise<HubInventory> => hubInventoryOnDaemon(client),
    queryKey: [identity, { host: daemon.host, version: daemon.version }],
  })
  const shellQuery = useQuery({
    enabled: !isBrowser,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryKey: SHELL_HUB_INVENTORIES_QUERY_KEY,
    queryFn: async (): Promise<readonly HubInventoryView[]> =>
      shellTrpcClient.hubInventories.query(),
  })
  const browserConnections = useMemo(
    () => (isBrowser ? browserEnvironmentConnections(environmentSessionsRevision) : []),
    [environmentSessionsRevision],
  )
  const browserSessions = useMemo(
    () => browserConnections.map((connection) => ensureEnvironmentSession(connection)),
    [browserConnections],
  )
  const secondaryQueries = useQueries({
    queries: browserSessions.map((entry) => ({
      enabled: isBrowser,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      queryKey: ['browser', 'hubInventory', entry.id],
      queryFn: async (): Promise<HubInventory> => hubInventoryOnDaemon(entry.client),
    })),
  })
  useEffect(() => {
    if (!isBrowser) return
    for (const entry of browserSessions) entry.session.start()
  }, [browserSessions])
  useEffect(() => {
    if (browserQuery.data !== undefined) setPrimaryEnvironmentId(browserQuery.data.environment.id)
  }, [browserQuery.data])
  useEffect(() => {
    // Electron never runs the browser effect above, so without this primaryEnvironmentId
    // stays null forever on the shell: environmentClientFor/environmentSessionFor only
    // recognize a real Environment id as local by matching it against primaryEnvironmentId,
    // and every Hub selection's environmentId is that real id (HubSelection needs it non-null
    // to persist which Environment a Worktree belongs to — see hub-selection.ts) even for the
    // local Environment. Left unset, every query keyed off a Hub target — Files, Git, Search,
    // Terminal, Actions — resolves no owning client and sits disabled/loading forever the
    // moment a worktree is opened.
    if (isBrowser) return
    const local = shellQuery.data?.find((source) => source.current)
    if (local !== undefined) setPrimaryEnvironmentId(local.inventory.environment.id)
    // Bridge the shell's pairing-minted Environment id to the daemon-announced one: every
    // other resolver in the app (environmentClientFor, environmentSessionFor, HubTarget)
    // keys off the daemon-announced id, not the shell's. This window's own binding can be a
    // saved Environment rather than This device (including a legacy remote-bound window), which makes
    // This device the secondary — bridge it to the same THIS_DEVICE_CONNECTION_ID
    // environmentDaemonPairs used for its entry, or every Files/Git/Terminal query keyed off
    // it resolves no owning session and "This device" reads permanently offline.
    for (const source of shellQuery.data ?? []) {
      if (source.environmentId !== null) {
        registerEnvironmentAlias(source.inventory.environment.id, source.environmentId)
      } else if (!source.current) {
        registerEnvironmentAlias(source.inventory.environment.id, THIS_DEVICE_CONNECTION_ID)
      }
    }
  }, [shellQuery.data])
  useEffect(() => {
    for (const [index, query] of secondaryQueries.entries()) {
      const entry = browserSessions[index]
      if (entry !== undefined && query.data !== undefined) {
        registerEnvironmentAlias(query.data.environment.id, entry.id)
      }
    }
  }, [browserSessions, secondaryQueries])
  if (!isBrowser) {
    return {
      inventories: shellQuery.data ?? [],
      status: shellQuery.isPending ? 'loading' : shellQuery.isError ? 'error' : 'ready',
    }
  }
  const primarySource =
    browserQuery.isError || browserQuery.data === undefined
      ? []
      : [{ environmentId: null, current: true, offline: false, inventory: browserQuery.data }]
  const secondarySources = secondaryQueries.flatMap((query) =>
    query.data === undefined
      ? []
      : [
          {
            environmentId: query.data.environment.id,
            current: false,
            offline: query.isError,
            inventory: query.data,
          },
        ],
  )
  const inventories = [...primarySource, ...secondarySources]
  const pending = browserQuery.isPending || secondaryQueries.some((query) => query.isPending)
  const failed = browserQuery.isError || secondaryQueries.some((query) => query.isError)
  return {
    inventories,
    status: inventories.length > 0 ? 'ready' : pending ? 'loading' : failed ? 'error' : 'ready',
  }
}

/** Live inventories for callers whose own surface already owns loading and error presentation. */
export function useHubInventories(): readonly HubInventoryView[] {
  return useHubInventoriesState().inventories
}

/** The inventory for this window's bound Environment, retained for narrow callers. */
export function useHubInventory(): HubInventory | null {
  return useHubInventories().find((source) => source.current)?.inventory ?? null
}
