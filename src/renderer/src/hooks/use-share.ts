import { onMutationError } from '@renderer/hooks/mutation-error'
import { setBrowserDaemonToken } from '@renderer/lib/daemon'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc, trpc } from '@renderer/lib/trpc'

/**
 * Settings → Share: how many clients hold a live session on THIS daemon, and the
 * single Revoke all action that rotates the shared token for everyone.
 */

export function useShareStatus(): { clients: number; tokenPath: string } | undefined {
  const { data } = trpc.shareStatus.useQuery(undefined, {
    // Count changes without this client doing anything (a phone connects, a tab
    // closes), so a trust surface that only refreshed on mount would quietly lie.
    refetchInterval: 15_000,
    staleTime: 0,
  })
  return data
}

export function useRotateDaemonToken(): {
  rotate: () => void
  isPending: boolean
} {
  const utils = trpc.useUtils()
  const adopt = shellTrpc.adoptRotatedToken.useMutation()
  const mutation = trpc.rotateDaemonToken.useMutation({
    onSuccess: async (result) => {
      // The initiator keeps the new secret so THIS window doesn't lock itself out.
      // Browser: localStorage + reconnect. Electron: shell updates local token or the
      // saved remote entry and pushes daemon-url-changed.
      if (isBrowser) {
        setBrowserDaemonToken(result.token)
      } else {
        await adopt.mutateAsync({ token: result.token })
      }
      await utils.shareStatus.invalidate()
    },
    onError: onMutationError('Revoke all'),
  })
  return {
    rotate: () => mutation.mutate(),
    isPending: mutation.isPending || adopt.isPending,
  }
}
