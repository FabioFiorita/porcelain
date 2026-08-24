import { parsePublicError } from '@porcelain/client-runtime/remote'
import type { EndpointKind } from '@porcelain/contracts'
import { SHELL_HUB_INVENTORIES_QUERY_KEY } from '@renderer/features/projects/hub-inventories'
import { onMutationError } from '@renderer/hooks/mutation-error'
import {
  setShellEnvironmentConnections,
  shellConnectionId,
} from '@renderer/lib/environment-sessions'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc, trpc } from '@renderer/lib/trpc'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

/**
 * One address of an environment group (one identity, many endpoints). `preferred`
 * is per KIND, not per address — a DHCP lease is not a preference — so every LAN
 * address of an environment reads as preferred once the LAN is the preferred kind.
 */
export type EnvironmentEndpoint = {
  url: string
  kind: EndpointKind
  preferred: boolean
}

export type EnvironmentStatus = {
  id: string | null
  state: 'online' | 'unauthorized' | 'offline'
  endpoint: string | null
  host: string | null
  /**
   * The Environment's display name: the human's nickname when it has one, otherwise the
   * machine name. Distinct from `host` on purpose — two daemons with their own homes on ONE
   * machine report the same host, and the nickname is the only thing that separates them.
   * Null means UNKNOWN — unreachable, or the shell could not ask — never "has no nickname",
   * so a row falls back to the name it already had rather than treating null as an answer.
   */
  name: string | null
  platform: string | null
  version: string | null
}

/**
 * Vanilla shell Remote RPC surface. Hooks below are the React Query binding;
 * this type is the only owner of those Electron-only procedures.
 */
export type WebLocalRemoteAdapter = {
  readonly remoteEnvironments: () => ReturnType<
    ReturnType<typeof shellTrpc.useUtils>['client']['remoteEnvironments']['query']
  >
  readonly environmentStatuses: () => ReturnType<
    ReturnType<typeof shellTrpc.useUtils>['client']['environmentStatuses']['query']
  >
  readonly pairEnvironmentConnection: (
    input: Parameters<
      ReturnType<typeof shellTrpc.useUtils>['client']['pairEnvironmentConnection']['mutate']
    >[0],
  ) => ReturnType<
    ReturnType<typeof shellTrpc.useUtils>['client']['pairEnvironmentConnection']['mutate']
  >
  readonly preferEnvironmentEndpoint: (
    input: Parameters<
      ReturnType<typeof shellTrpc.useUtils>['client']['preferEnvironmentEndpoint']['mutate']
    >[0],
  ) => ReturnType<
    ReturnType<typeof shellTrpc.useUtils>['client']['preferEnvironmentEndpoint']['mutate']
  >
  readonly removeEnvironmentEndpoint: (
    input: Parameters<
      ReturnType<typeof shellTrpc.useUtils>['client']['removeEnvironmentEndpoint']['mutate']
    >[0],
  ) => ReturnType<
    ReturnType<typeof shellTrpc.useUtils>['client']['removeEnvironmentEndpoint']['mutate']
  >
  readonly connectRemoteEnvironment: (
    input: Parameters<
      ReturnType<typeof shellTrpc.useUtils>['client']['connectRemoteEnvironment']['mutate']
    >[0],
  ) => ReturnType<
    ReturnType<typeof shellTrpc.useUtils>['client']['connectRemoteEnvironment']['mutate']
  >
  readonly disconnectRemoteEnvironment: () => ReturnType<
    ReturnType<typeof shellTrpc.useUtils>['client']['disconnectRemoteEnvironment']['mutate']
  >
  readonly openWindowInEnvironment: (
    input: Parameters<
      ReturnType<typeof shellTrpc.useUtils>['client']['openWindowInEnvironment']['mutate']
    >[0],
  ) => ReturnType<
    ReturnType<typeof shellTrpc.useUtils>['client']['openWindowInEnvironment']['mutate']
  >
  readonly renameEnvironment: (
    input: Parameters<
      ReturnType<typeof shellTrpc.useUtils>['client']['renameEnvironment']['mutate']
    >[0],
  ) => ReturnType<ReturnType<typeof shellTrpc.useUtils>['client']['renameEnvironment']['mutate']>
  readonly removeRemoteEnvironment: (
    input: Parameters<
      ReturnType<typeof shellTrpc.useUtils>['client']['removeRemoteEnvironment']['mutate']
    >[0],
  ) => ReturnType<
    ReturnType<typeof shellTrpc.useUtils>['client']['removeRemoteEnvironment']['mutate']
  >
}

function pairingErrorMessage(error: unknown): string | null {
  const parsed = parsePublicError(error)
  if (parsed.kind === 'public' || parsed.kind === 'update-required') return parsed.error.message
  if (error !== null && typeof error === 'object' && 'message' in error) {
    return typeof error.message === 'string' ? error.message : null
  }
  return null
}

/**
 * Saved remote environments: list other Porcelain daemons and bind THIS window (or
 * a new one) to one. Per-window, so one project can stay open while another window
 * uses a different machine. Wraps the SHELL router (Electron-only).
 * Switch = main-process hard-reload of THIS window; the renderer must NOT also
 * `location.reload()` — that double-reload races.
 */
export function useRemoteEnvironments():
  | {
      activeId: string | null
      defaultId: string | null
      environments: { id: string; name: string; url: string; endpoints: EnvironmentEndpoint[] }[]
    }
  | undefined {
  const { data } = shellTrpc.remoteEnvironments.useQuery(undefined, { enabled: !isBrowser })
  return data
}

/**
 * Feed the shell's reachable Environments into the session registry, so an Electron window
 * can open its own session to a daemon it is not bound to — the browser has done this from
 * its own stored connections since Hub fan-out shipped.
 *
 * Mounted ONCE, in AppShell. Sessions are not started here: the registry hands one out when a
 * panel actually addresses that Environment.
 */
export function useShellEnvironmentConnections(): void {
  const { data } = shellTrpc.environmentConnections.useQuery(undefined, {
    enabled: !isBrowser,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
  useEffect(() => {
    if (isBrowser || data === undefined) return
    setShellEnvironmentConnections(
      data.map((connection) => ({
        id: shellConnectionId(connection.id),
        name: connection.name,
        url: connection.url,
        token: connection.token,
      })),
    )
  }, [data])
}

export function useEnvironmentStatuses(): Map<string | null, EnvironmentStatus> {
  const { data } = shellTrpc.environmentStatuses.useQuery(undefined, {
    enabled: !isBrowser,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
  return useMemo<Map<string | null, EnvironmentStatus>>(
    () => new Map((data ?? []).map((status) => [status.id, status])),
    [data],
  )
}

export function usePairEnvironmentConnection(): {
  pair: (input: {
    connectionLink: string
    groupId?: string | null
    connectThisWindow?: boolean
  }) => void
  isPending: boolean
  error: string | null
} {
  const utils = shellTrpc.useUtils()
  const mutation = shellTrpc.pairEnvironmentConnection.useMutation({
    onSuccess: async (result: {
      id: string
      reloaded: boolean
      merged: boolean
    }): Promise<void> => {
      // Main reloads THIS window when connectThisWindow (default); only invalidate
      // when we stayed put so the list refreshes without a full boot.
      if (!result.reloaded) {
        await Promise.all([
          utils.remoteEnvironments.invalidate(),
          utils.environmentStatuses.invalidate(),
        ])
      }
    },
  })
  return {
    pair: (input: {
      connectionLink: string
      groupId?: string | null
      connectThisWindow?: boolean
    }): void => mutation.mutate(input),
    isPending: mutation.isPending,
    error: pairingErrorMessage(mutation.error),
  }
}

export function useRemoveEnvironmentEndpoint(): {
  remove: (input: { id: string; url: string }) => void
  isPending: boolean
} {
  const utils = shellTrpc.useUtils()
  const mutation = shellTrpc.removeEnvironmentEndpoint.useMutation({
    onSuccess: async (): Promise<void> => {
      await Promise.all([
        utils.remoteEnvironments.invalidate(),
        utils.environmentStatuses.invalidate(),
      ])
    },
    onError: onMutationError('Remove connection'),
  })
  return {
    remove: (input: { id: string; url: string }): void => mutation.mutate(input),
    isPending: mutation.isPending,
  }
}

export function useConnectRemoteEnvironment(): {
  connect: (id: string) => void
  pendingId: string | null
} {
  const mutation = shellTrpc.connectRemoteEnvironment.useMutation({
    // Main-process reload handles the switch — no renderer reload / invalidate.
    onError: onMutationError('Connect remote daemon'),
  })
  return {
    connect: (id: string): void => mutation.mutate({ id }),
    pendingId: mutation.isPending ? (mutation.variables?.id ?? null) : null,
  }
}

export function useDisconnectRemoteEnvironment(): { disconnect: () => void; isPending: boolean } {
  const mutation = shellTrpc.disconnectRemoteEnvironment.useMutation({
    // Main-process reload handles the switch — no renderer reload / invalidate.
    onError: onMutationError('Disconnect remote daemon'),
  })
  return { disconnect: () => mutation.mutate(), isPending: mutation.isPending }
}

export function useOpenWindowInEnvironment(): {
  open: (input: { environmentId: string | null; repoPath?: string }) => void
} {
  const mutation = shellTrpc.openWindowInEnvironment.useMutation({
    onError: onMutationError('Open window in environment'),
  })
  return {
    open: (input: { environmentId: string | null; repoPath?: string }): void =>
      mutation.mutate(input),
  }
}

export function useRemoveRemoteEnvironment(): {
  remove: (id: string) => void
  pendingId: string | null
} {
  const utils = shellTrpc.useUtils()
  const removeMutation = shellTrpc.removeRemoteEnvironment.useMutation({
    onSuccess: async () => {
      await utils.remoteEnvironments.invalidate()
    },
    onError: onMutationError('Remove remote daemon'),
  })
  return {
    remove: (id: string): void => removeMutation.mutate({ id }),
    pendingId: removeMutation.isPending ? (removeMutation.variables?.id ?? null) : null,
  }
}

/**
 * Name one Environment — This device or any saved group — from wherever it is listed.
 * The write lands on the daemon that owns the Environment, so every client that pairs with
 * it sees the same name. A blank name clears the nickname back to the machine name.
 */
export function useRenameEnvironment(): {
  /**
   * `onSuccess` is how an editor knows the write actually landed: the caller keeps the typed
   * name on screen until then, so a failure leaves something to correct rather than a toast
   * and an empty row.
   */
  rename: (
    input: { environmentId: string | null; name: string },
    options?: { onSuccess?: () => void },
  ) => void
  pendingId: string | null | undefined
} {
  const utils = shellTrpc.useUtils()
  const daemonUtils = trpc.useUtils()
  const queryClient = useQueryClient()
  const mutation = shellTrpc.renameEnvironment.useMutation({
    onSuccess: async (): Promise<void> => {
      // The statuses query is 30s-stale by design; without these the row the human just
      // renamed keeps showing the old label until the next focus refetch. The daemon-side
      // identity is a SEPARATE cache — this window reads its own Environment through it.
      await Promise.all([
        utils.remoteEnvironments.invalidate(),
        utils.environmentStatuses.invalidate(),
        // The Hub's shell fan-out has its own literal key, not a tRPC one — invalidating
        // `utils.hubInventories` would silently miss it and leave the Hub badges stale.
        queryClient.invalidateQueries({ exact: true, queryKey: SHELL_HUB_INVENTORIES_QUERY_KEY }),
        daemonUtils.environmentIdentity.invalidate(),
      ])
    },
    onError: onMutationError('Rename environment'),
  })
  return {
    rename: (
      input: { environmentId: string | null; name: string },
      options?: { onSuccess?: () => void },
    ): void => mutation.mutate(input, options),
    pendingId: mutation.isPending ? mutation.variables?.environmentId : undefined,
  }
}
