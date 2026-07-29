import type { EndpointKind } from '@main/remote-daemon'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'

/**
 * One address of an environment (phase 5: one identity, many endpoints). `preferred`
 * is per KIND, not per address — a DHCP lease is not a preference — so every LAN
 * address of an environment reads as preferred once the LAN is the preferred kind.
 */
export interface EnvironmentEndpoint {
  url: string
  kind: EndpointKind
  preferred: boolean
}

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
      environments: { id: string; name: string; url: string; endpoints: EnvironmentEndpoint[] }[]
    }
  | undefined {
  const { data } = shellTrpc.remoteEnvironments.useQuery(undefined, { enabled: !isBrowser })
  return data
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
    // The procedure also returns `merged` (this address joined a machine we already had,
    // phase 5). Deliberately NOT surfaced: every caller adds with connectThisWindow, so the
    // window hard-reloads onto that environment and any "added as another address" line
    // would flash for one frame. The reload IS the feedback — it lands on the merged
    // environment. Re-expose it the day a non-connecting add path exists, not before.
  }
}

// Endpoint add/remove/prefer live on the shell router (multi-address environments,
// phase 5) and are driven by addRemoteEnvironment's merge path + status failover —
// no Settings UI exposes them today. When a multi-address editor lands, wrap those
// procedures here again rather than calling shellTrpc from components.

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
