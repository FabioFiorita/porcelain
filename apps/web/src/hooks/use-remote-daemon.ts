import type { EndpointKind } from '@main/remote-daemon'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'

/**
 * One address of an environment group (one identity, many endpoints). `preferred`
 * is per KIND, not per address — a DHCP lease is not a preference — so every LAN
 * address of an environment reads as preferred once the LAN is the preferred kind.
 */
export interface EnvironmentEndpoint {
  url: string
  kind: EndpointKind
  preferred: boolean
}

/**
 * Saved remote environments: list other Porcelain daemons and bind THIS window (or
 * a new one) to one. Per-window, so one project can stay open while another window
 * uses a different machine. Wraps the SHELL router (Electron-only).
 * Switch = main-process hard-reload of THIS window (see `switchWindowEnvironment` in
 * `src/main/window.ts`); the renderer must NOT also `location.reload()` — that
 * double-reload races. Removing a non-active environment just invalidates the list.
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
    error: mutation.error?.message ?? null,
    // The procedure also returns `merged` (this address joined an existing group). It is not
    // surfaced: pairing a new group reloads into it, while adding to an existing group refreshes
    // the endpoint list in place.
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
    // `variables` holds the in-flight input while pending, so the connecting row
    // can show its own spinner text instead of every row spinning at once.
    pendingId: mutation.isPending ? (mutation.variables?.id ?? null) : null,
  }
}

export function useDisconnectRemoteEnvironment(): { disconnect: () => void; isPending: boolean } {
  const mutation = shellTrpc.disconnectRemoteEnvironment.useMutation({
    // Main-process reload handles the switch — no renderer reload / invalidate.
    // Disconnect has no inline error surface — a failed clear would otherwise be silent.
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
      // Main process reloads every window that was on the removed env (including
      // this one when wasActive). Invalidate for the case where this window stayed put.
      await utils.remoteEnvironments.invalidate()
    },
    onError: onMutationError('Remove remote daemon'),
  })
  return {
    remove: (id: string): void => removeMutation.mutate({ id }),
    pendingId: removeMutation.isPending ? (removeMutation.variables?.id ?? null) : null,
  }
}
