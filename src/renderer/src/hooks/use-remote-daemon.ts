import { onMutationError } from '@renderer/hooks/mutation-error'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'

/**
 * The remote-daemon override (remote-envs Phase 4): point this Mac app at a
 * REMOTE daemon over the tailnet, or clear back to the local child. Wraps the
 * three SHELL-router procedures (Electron-only — the whole feature is hidden in
 * the browser client, so these never run there).
 *
 * Switch semantics = full reload. After a successful connect OR disconnect we
 * `window.location.reload()`: the preload daemon getter now returns the new
 * pair, so the renderer re-boots cleanly against the new daemon and restores ITS
 * recents. A live re-point would leave repo paths, open tabs, and PTY
 * attachments pointing at the other machine's disk — reload is the bulletproof
 * v1. The reload is synchronous (no floating promise); it only ever runs in the
 * Electron client, where this UI exists.
 */
export function useRemoteDaemon(): { url: string } | null | undefined {
  const { data } = shellTrpc.remoteDaemon.useQuery(undefined, { enabled: !isBrowser })
  return data
}

export function useSetRemoteDaemon(): {
  connect: (input: { url: string; token: string }) => void
  isPending: boolean
  error: string | null
} {
  const utils = shellTrpc.useUtils()
  const mutation = shellTrpc.setRemoteDaemon.useMutation({
    onSuccess: async () => {
      await utils.remoteDaemon.invalidate()
      window.location.reload()
    },
  })
  return {
    connect: (input) => mutation.mutate(input),
    isPending: mutation.isPending,
    error: mutation.error?.message ?? null,
  }
}

export function useClearRemoteDaemon(): { disconnect: () => void; isPending: boolean } {
  const utils = shellTrpc.useUtils()
  const mutation = shellTrpc.clearRemoteDaemon.useMutation({
    onSuccess: async () => {
      await utils.remoteDaemon.invalidate()
      window.location.reload()
    },
    // Unlike connect (whose error renders inline in the settings block), disconnect
    // has no inline surface — a failed clear would otherwise be silent.
    onError: onMutationError('Disconnect remote daemon'),
  })
  return { disconnect: () => mutation.mutate(), isPending: mutation.isPending }
}
