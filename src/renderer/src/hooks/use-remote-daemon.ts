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
    // The procedure also returns `merged` (this address joined a machine we already had,
    // phase 5). Deliberately NOT surfaced: every caller adds with connectThisWindow, so the
    // window hard-reloads onto that environment and any "added as another address" line
    // would flash for one frame. The reload IS the feedback — it lands on the merged
    // environment. Re-expose it the day a non-connecting add path exists, not before.
  }
}

/**
 * Teach an environment another way in (phase 5). Inline `error` like add-environment:
 * a mistyped or unreachable address is a normal, correctable mistake, not a toast.
 * Resolves true only when the address actually landed, so the caller clears its field
 * on success and keeps what the human typed when it didn't.
 */
export function useAddEnvironmentEndpoint(): {
  addEndpoint: (input: { id: string; url: string }) => Promise<boolean>
  isPending: boolean
  error: string | null
} {
  const utils = shellTrpc.useUtils()
  const mutation = shellTrpc.addEnvironmentEndpoint.useMutation({
    // Statuses too: the new address may be the one that answers, and the live marker
    // is read from `environmentStatuses`, not from the environment list.
    onSuccess: async () => {
      await Promise.all([
        utils.remoteEnvironments.invalidate(),
        utils.environmentStatuses.invalidate(),
      ])
    },
  })
  return {
    addEndpoint: async (input) => {
      try {
        await mutation.mutateAsync(input)
        return true
      } catch {
        return false
      }
    },
    isPending: mutation.isPending,
    error: mutation.error?.message ?? null,
  }
}

export function useRemoveEnvironmentEndpoint(): {
  removeEndpoint: (input: { id: string; url: string }) => void
  pendingUrl: string | null
} {
  const utils = shellTrpc.useUtils()
  const mutation = shellTrpc.removeEnvironmentEndpoint.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.remoteEnvironments.invalidate(),
        utils.environmentStatuses.invalidate(),
      ])
    },
    onError: onMutationError('Remove address'),
  })
  return {
    removeEndpoint: (input) => mutation.mutate(input),
    // Keyed by url, not by environment: several endpoint rows of the SAME environment
    // are on screen at once, and only the one being removed should look busy.
    pendingUrl: mutation.isPending ? (mutation.variables?.url ?? null) : null,
  }
}

/** Pin the KIND of that address as the one to try first — failover still applies. */
export function usePreferEnvironmentEndpoint(): {
  preferEndpoint: (input: { id: string; url: string }) => void
  pendingUrl: string | null
} {
  const utils = shellTrpc.useUtils()
  const mutation = shellTrpc.preferEnvironmentEndpoint.useMutation({
    // Preference reorders the failover walk, so a different address can become the
    // live one — the statuses query owns that marker.
    onSuccess: async () => {
      await Promise.all([
        utils.remoteEnvironments.invalidate(),
        utils.environmentStatuses.invalidate(),
      ])
    },
    onError: onMutationError('Prefer address'),
  })
  return {
    preferEndpoint: (input) => mutation.mutate(input),
    pendingUrl: mutation.isPending ? (mutation.variables?.url ?? null) : null,
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
