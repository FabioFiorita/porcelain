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
  })
  return {
    setEnabled: (enabled) => mutation.mutate(enabled),
    isPending: mutation.isPending,
  }
}
