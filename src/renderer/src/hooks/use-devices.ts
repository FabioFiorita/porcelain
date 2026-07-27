import type { ConnectedDevices } from '@backend/api'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'

/**
 * The roster of devices paired with THIS daemon, and the per-device revoke.
 *
 * Phase 4 of environments-v2: pairing mints each device its own credential, so
 * "revoke" finally means one device rather than rotating the shared token and
 * re-pairing everything.
 */

/** Paired devices plus what each is doing right now; undefined until the first fetch. */
export function useConnectedDevices(): ConnectedDevices | undefined {
  const { data } = trpc.connectedDevices.useQuery(undefined, {
    // The roster changes without this client doing anything — a phone connects, an
    // iPad's session drops — so a trust surface that only refreshed on mount would
    // quietly lie. Same cheap 15s beat as usePairingStatus.
    refetchInterval: 15_000,
    staleTime: 0,
  })
  return data
}

export function useRevokeDevice(): { revoke: (id: string) => void; isPending: boolean } {
  const utils = trpc.useUtils()
  const mutation = trpc.revokeDevice.useMutation({
    // The daemon also closes that device's live sockets, so both the credential and
    // the `connections` count on screen are stale the moment this resolves.
    onSuccess: async () => await utils.connectedDevices.invalidate(),
    onError: onMutationError('Revoke device'),
  })
  return { revoke: (id: string) => mutation.mutate(id), isPending: mutation.isPending }
}
