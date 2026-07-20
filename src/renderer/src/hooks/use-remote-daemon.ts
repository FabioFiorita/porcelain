import { onMutationError } from '@renderer/hooks/mutation-error'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'

/**
 * Saved remote environments: list other machines' Porcelain daemons and bind
 * THIS window (or open a new window) to one of them. Environments are
 * per-window — a local project can stay open while another window uses the
 * Beelink. Wraps the SHELL-router procedures (Electron-only — the whole feature
 * is hidden in the browser client).
 *
 * Switch semantics = main-process hard-reload of THIS window onto the new
 * daemon, landing on the welcome/landing page for that environment (see
 * `switchWindowEnvironment` in `src/main/window.ts`). The renderer must NOT also
 * `location.reload()` — main already does, and a double-reload races. Connecting,
 * disconnecting, adding (with connect), and removing the environment THIS window
 * is on all take that path. Removing a NON-active-for-this-window environment
 * just invalidates the list.
 */
export function useRemoteEnvironments():
  | {
      activeId: string | null
      defaultId: string | null
      environments: { id: string; name: string; url: string }[]
    }
  | undefined {
  const { data } = shellTrpc.remoteEnvironments.useQuery(undefined, { enabled: !isBrowser })
  return data
}

/**
 * The remote environment THIS window is bound to, or null when on This device
 * (local daemon). Electron-only — always null in the browser client.
 */
export function useActiveRemoteEnvironment(): {
  id: string
  name: string
  url: string
} | null {
  const data = useRemoteEnvironments()
  if (data === undefined || data.activeId === null) return null
  return data.environments.find((env) => env.id === data.activeId) ?? null
}

export function useAddRemoteEnvironment(): {
  add: (input: { name: string; url: string; token: string; connectThisWindow?: boolean }) => void
  isPending: boolean
  error: string | null
} {
  const utils = shellTrpc.useUtils()
  const mutation = shellTrpc.addRemoteEnvironment.useMutation({
    onSuccess: async (result) => {
      // Main reloads THIS window when connectThisWindow (default); only invalidate
      // when we stayed put so the list refreshes without a full boot.
      if (!result.reloaded) await utils.remoteEnvironments.invalidate()
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
  const mutation = shellTrpc.connectRemoteEnvironment.useMutation({
    // Main-process reload handles the switch — no renderer reload / invalidate.
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
    open: (input) => mutation.mutate(input),
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
    remove: (id) => removeMutation.mutate({ id }),
    pendingId: removeMutation.isPending ? (removeMutation.variables?.id ?? null) : null,
  }
}
