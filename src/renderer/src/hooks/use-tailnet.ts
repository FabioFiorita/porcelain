import { trpc } from '@renderer/lib/trpc'

export interface TailnetStatus {
  enabled: boolean
  url: string | null
}

/** The persisted tailnet-bind flag plus the live listener url (null when not up). */
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
  })
  return {
    setEnabled: (enabled) => mutation.mutate(enabled),
    isPending: mutation.isPending,
  }
}
