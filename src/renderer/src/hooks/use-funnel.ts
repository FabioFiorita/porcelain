import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'

export interface FunnelStatus {
  enabled: boolean
  url: string | null
  managed: boolean
  /** Why nothing bound: 'unavailable' = tailscale/funnel missing, 'conflict' = port squatted. */
  error: 'unavailable' | 'conflict' | null
  /** True when PORCELAIN_FUNNEL_BIND=1 force-enabled the bind at boot (not togglable). */
  envForced: boolean
}

export function useFunnelStatus(): FunnelStatus | undefined {
  const { data } = trpc.funnelStatus.useQuery(undefined, {
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  })
  return data
}

export function useSetFunnelBind(): {
  setEnabled: (enabled: boolean) => void
  isPending: boolean
} {
  const utils = trpc.useUtils()
  const mutation = trpc.setFunnelBind.useMutation({
    onSuccess: async () => {
      await utils.funnelStatus.invalidate()
    },
    onError: onMutationError('Update Internet sharing'),
  })
  return {
    setEnabled: (enabled: boolean): void => mutation.mutate(enabled),
    isPending: mutation.isPending,
  }
}
