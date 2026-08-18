import { hubInventoryQuery } from '@porcelain/client-runtime/projects'
import type { HubInventory } from '@porcelain/contracts/projects'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import {
  browserEnvironmentConnections,
  ensureEnvironmentSession,
  registerEnvironmentAlias,
  setPrimaryEnvironmentId,
  useEnvironmentSessionsRevision,
} from '@renderer/lib/environment-sessions'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpcClient, trpc } from '@renderer/lib/trpc'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { hubInventoryOnDaemon } from './project-transport'

/** One live inventory plus the shell identity needed to route its actions safely. */
export type HubInventoryView = Readonly<{
  environmentId: string | null
  current: boolean
  inventory: HubInventory
}>

/**
 * Electron's Hub tree reads through the shell router (one IPC round trip fans out to every
 * connected Environment), never the per-Environment `hubInventoryQuery()` shape the browser
 * uses — so a mutation invalidating only that shape (project-data.ts's `invalidateProjectQueries`)
 * leaves this query stale on Electron until `staleTime` (30s) or a window-focus refetch catches
 * up. Exported so that invalidation can target it directly instead of duplicating the literal.
 */
export const SHELL_HUB_INVENTORIES_QUERY_KEY = ['shell', 'hubInventories'] as const

/** Live Hub inventories: shell fan-out in Electron and one session per browser Environment. */
export function useHubInventories(): readonly HubInventoryView[] {
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
  }, [shellQuery.data])
  useEffect(() => {
    for (const [index, query] of secondaryQueries.entries()) {
      const entry = browserSessions[index]
      if (entry !== undefined && query.data !== undefined) {
        registerEnvironmentAlias(query.data.environment.id, entry.id)
      }
    }
  }, [browserSessions, secondaryQueries])
  if (!isBrowser) return shellQuery.data ?? []
  const primarySource =
    browserQuery.isError || browserQuery.data === undefined
      ? []
      : [{ environmentId: null, current: true, inventory: browserQuery.data }]
  const secondarySources = secondaryQueries.flatMap((query) =>
    query.isError || query.data === undefined
      ? []
      : [{ environmentId: query.data.environment.id, current: false, inventory: query.data }],
  )
  return [...primarySource, ...secondarySources]
}

/** The inventory for this window's bound Environment, retained for narrow callers. */
export function useHubInventory(): HubInventory | null {
  return useHubInventories().find((source) => source.current)?.inventory ?? null
}
