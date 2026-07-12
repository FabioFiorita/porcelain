import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'

export interface TailnetStatus {
  enabled: boolean
  url: string | null
  /** Why nothing bound: 'in-use' = port 43117 squatted (likely a stale daemon). */
  error: 'in-use' | null
  /** True when PORCELAIN_TAILNET_BIND=1 force-enabled the bind at boot (not togglable). */
  envForced: boolean
}

/** The persisted tailnet-bind flag (or env force) plus the live listener url (null when not up). */
export function useTailnetStatus(): TailnetStatus | undefined {
  const { data } = trpc.tailnetStatus.useQuery()
  return data
}

/** Toggle the tailnet bind; the daemon starts/stops the listener and the status refetches. */
export function useSetTailnetBind(): {
  setEnabled: (enabled: boolean) => void
  isPending: boolean
} {
  const utils = trpc.useUtils()
  const mutation = trpc.setTailnetBind.useMutation({
    onSuccess: () => utils.tailnetStatus.invalidate(),
    // A bind that can't find an interface surfaces inline via tailnetStatus; a rejected
    // toggle write itself would otherwise be invisible, so toast it.
    onError: onMutationError('Toggle Tailscale sharing'),
  })
  return {
    setEnabled: (enabled) => mutation.mutate(enabled),
    isPending: mutation.isPending,
  }
}
