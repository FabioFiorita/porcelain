import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'

export function useFunnelStatus() {
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
  return { setEnabled: (enabled) => mutation.mutate(enabled), isPending: mutation.isPending }
}
