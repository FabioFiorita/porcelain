import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'

export interface LanStatus {
  enabled: boolean
  url: string | null
  numericUrl: string | null
  /** Why nothing bound: 'in-use' = port 43117 squatted (likely a stale daemon). */
  error: 'in-use' | null
  /** True when PORCELAIN_LAN_BIND=1 force-enabled the bind at boot (not togglable). */
  envForced: boolean
}

/** The persisted LAN-bind flag (or env force) plus the live listener urls (null when not up). */
export function useLanStatus(): LanStatus | undefined {
  const { data } = trpc.lanStatus.useQuery()
  return data
}

/** Toggle the LAN bind; the daemon starts/stops the listener and the status refetches. */
export function useSetLanBind(): {
  setEnabled: (enabled: boolean) => void
  isPending: boolean
} {
  const utils = trpc.useUtils()
  const mutation = trpc.setLanBind.useMutation({
    onSuccess: () => utils.lanStatus.invalidate(),
    // A bind that can't find an interface surfaces inline via lanStatus; a rejected
    // toggle write itself would otherwise be invisible, so toast it.
    onError: onMutationError('Toggle local network sharing'),
  })
  return {
    setEnabled: (enabled) => mutation.mutate(enabled),
    isPending: mutation.isPending,
  }
}
