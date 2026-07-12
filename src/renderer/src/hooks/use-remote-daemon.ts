import { onMutationError } from '@renderer/hooks/mutation-error'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'

/**
 * Saved remote environments (remote-envs Phase 4): keep a list of other machines'
 * Porcelain daemons and switch this Mac app between them, or clear back to the
 * local child. Wraps the SHELL-router procedures (Electron-only — the whole
 * feature is hidden in the browser client, so these never run there).
 *
 * Switch semantics = full reload. Adding activates the new environment, connecting
 * flips to another, disconnecting clears, and removing the ACTIVE environment
 * clears too — all of which change which daemon the window talks to, so each does
 * `window.location.reload()`: the preload daemon getter now returns the new pair,
 * so the renderer re-boots cleanly against the new daemon and restores ITS
 * recents. A live re-point would leave repo paths, open tabs, and PTY attachments
 * pointing at the other machine's disk — reload is the bulletproof v1. Removing a
 * NON-active environment changes nothing the window is pointed at, so it just
 * invalidates the list. The reload is synchronous (no floating promise); it only
 * ever runs in the Electron client, where this UI exists.
 */
export function useRemoteEnvironments():
  | { activeId: string | null; environments: { id: string; name: string; url: string }[] }
  | undefined {
  const { data } = shellTrpc.remoteEnvironments.useQuery(undefined, { enabled: !isBrowser })
  return data
}

export function useAddRemoteEnvironment(): {
  add: (input: { name: string; url: string; token: string }) => void
  isPending: boolean
  error: string | null
} {
  const utils = shellTrpc.useUtils()
  const mutation = shellTrpc.addRemoteEnvironment.useMutation({
    onSuccess: async () => {
      await utils.remoteEnvironments.invalidate()
      window.location.reload()
    },
  })
  return {
    add: (input) => mutation.mutate(input),
    isPending: mutation.isPending,
    error: mutation.error?.message ?? null,
  }
}

export function useConnectRemoteEnvironment(): {
  connect: (id: string) => void
  pendingId: string | null
} {
  const utils = shellTrpc.useUtils()
  const mutation = shellTrpc.connectRemoteEnvironment.useMutation({
    onSuccess: async () => {
      await utils.remoteEnvironments.invalidate()
      window.location.reload()
    },
    onError: onMutationError('Connect remote daemon'),
  })
  return {
    connect: (id) => mutation.mutate({ id }),
    // `variables` holds the in-flight input while pending, so the connecting row
    // can show its own spinner text instead of every row spinning at once.
    pendingId: mutation.isPending ? (mutation.variables?.id ?? null) : null,
  }
}

export function useDisconnectRemoteEnvironment(): { disconnect: () => void; isPending: boolean } {
  const utils = shellTrpc.useUtils()
  const mutation = shellTrpc.disconnectRemoteEnvironment.useMutation({
    onSuccess: async () => {
      await utils.remoteEnvironments.invalidate()
      window.location.reload()
    },
    // Disconnect has no inline error surface — a failed clear would otherwise be silent.
    onError: onMutationError('Disconnect remote daemon'),
  })
  return { disconnect: () => mutation.mutate(), isPending: mutation.isPending }
}

export function useRemoveRemoteEnvironment(): {
  remove: (id: string) => void
  pendingId: string | null
} {
  const utils = shellTrpc.useUtils()
  const removeMutation = shellTrpc.removeRemoteEnvironment.useMutation({
    onSuccess: async (result) => {
      await utils.remoteEnvironments.invalidate()
      // Removing the ACTIVE environment re-points the window (back to local); a
      // non-active removal just drops a list row, so the invalidate above is enough.
      if (result.wasActive) window.location.reload()
    },
    onError: onMutationError('Remove remote daemon'),
  })
  return {
    remove: (id) => removeMutation.mutate({ id }),
    pendingId: removeMutation.isPending ? (removeMutation.variables?.id ?? null) : null,
  }
}
