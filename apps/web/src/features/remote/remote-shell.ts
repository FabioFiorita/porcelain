import { parsePublicError } from '@porcelain/client-runtime/remote'
import type { EndpointKind } from '@porcelain/contracts'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'
import { useMemo } from 'react'

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

export function usePreferEnvironmentEndpoint(): {
  prefer: (input: { id: string; url: string }) => void
  isPending: boolean
} {
  const utils = shellTrpc.useUtils()
  const mutation = shellTrpc.preferEnvironmentEndpoint.useMutation({
    onSuccess: async (): Promise<void> => {
      await Promise.all([
        utils.remoteEnvironments.invalidate(),
        utils.environmentStatuses.invalidate(),
      ])
    },
    onError: onMutationError('Set primary connection'),
  })
  return {
    prefer: (input: { id: string; url: string }): void => mutation.mutate(input),
    isPending: mutation.isPending,
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
